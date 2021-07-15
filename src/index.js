const path = require('path');
const crypto = require('crypto');

const o2nHashMap = {}; // 旧hash值到新hash值的映射关系表

const specialSeparator = '___'; // 主文件和之间 extname 特殊的分隔符

/**
 *
 * 计算输入内容的hash值
 *
 * @param {Object} HashObj hash配置对象
 * @param {Function | String} HashObj.hashFunction hash 函数
 * @param {String} HashObj.hashDigest hash编码
 *                 @see https://webpack.js.org/configuration/output/#outputhashdigest
 * @param {Number} HashObj.hashDigestLength hash长度
 *                 @see https://webpack.js.org/configuration/output/#outputhashdigestlength
 * @param {Function} HashObj.hashSalt 可选参数, hash 函数
 *                 @see https://webpack.js.org/configuration/output/#outputhashsalt
 * @param {String} 源码
 *
 * @returns {Object} hashString
 * @returns {String} hashString.fullHash 完整的hash值
 * @returns {String} hashString.shortHash 根据 hashDigestLength 裁切的hash值
*/
const hashSource = ({ hashFunction, hashDigest, hashDigestLength, hashSalt }, source) => {
  const hashObj = crypto.createHash(hashFunction).update(source);
  if (hashSalt) hashObj.update(hashSalt);
  const fullHash = hashObj.digest(hashDigest);
  return {
    fullHash,
    shortHash: fullHash.substr(0, hashDigestLength),
  };
};

/**
 *
 * 替换资源文件中的文件名
 *
 * @param {Asset} asset 文件资源
 * @param {String} oldHash 旧hash值
 * @param {String} newHash 新hash值
 */
function replaceHashInAsset(asset, oldHash, newHash) {
  const oldHashReg = new RegExp(oldHash, 'g'); // 全局替换
  const replacedAsset = asset;
  const handlers = {
    ReplaceSource() {
      replacedAsset._source = replaceHashInAsset(replacedAsset._source, oldHash, newHash);
      return replacedAsset;
    },
    CachedSource() {
      replacedAsset._cachedSource = replacedAsset.source().replace(oldHashReg, newHash);
      return replacedAsset;
    },
    RawSource() {
      // 两个都写,不知道到底哪个起作用, webpack-source 源码里是 this._value 存储的字符串,不晓得为啥变成了_valueAsString
      // 不讲武德
      replacedAsset._value = replacedAsset.source().replace(oldHashReg, newHash);
      replacedAsset._valueAsString = replacedAsset.source().replace(oldHashReg, newHash);
      return replacedAsset;
    },
    SourceMapSource() {
      replacedAsset._valueAsString = replacedAsset.source().replace(oldHashReg, newHash);
      replacedAsset._value = replacedAsset.source().replace(oldHashReg, newHash);
      return replacedAsset;
    },
    ConcatSource() {
      replacedAsset._children = replacedAsset._children.map(child => replaceHashInAsset(child, oldHash, newHash));
      return replacedAsset;
    },
  };

  // string 类型直接替换
  if (typeof replacedAsset === 'string') {
    return replacedAsset.replace(oldHashReg, newHash);
  }
  // 针对不同类型的处理
  if (handlers[replacedAsset.constructor.name]) {
    return handlers[replacedAsset.constructor.name]();
  }

  throw new Error(`Unknown asset type (${replacedAsset.constructor.name})!. `
    + 'Unfortunately this type of asset is not supported yet. '
    + 'Please raise an issue and we will look into it asap');
}

/**
 * 计算chunk的新hash值
 *
 * This function updates the *name* of the main file (i.e. source code), and the *content* of the
 * secondary files (i.e source maps)
 */
function reHashChunk(chunk, assets, compilation, hashType) {
  // 需过滤掉chunk.id是数字的块，一般都是由dynamic import 生成的
  const isMainFile = file => (file.endsWith('.js') || file.endsWith('.css')) && chunk.name !== null;
  // Update the name of the main files
  const chunkFiles = Array.from(chunk.files);
  // 遍历块包含的文件
  chunkFiles.filter(isMainFile).forEach((oldChunkName) => {
    const asset = assets[oldChunkName];
    // 根据生成文件内容计算出新hash值
    const {
      shortHash: newHash,
    } = hashSource(compilation.outputOptions, asset.source());

    const extname = path.extname(oldChunkName);
    const oldHash = getOldHash(hashType, oldChunkName, chunk);

    // output 配置中 [chunkhash] 使用的值是 chunk.renderedHash, 如果存在,可以直接
    if (oldChunkName.includes(oldHash)) {
      let oldHackedHash = oldHash;
      if (hashType === 'chunkhash') { // chunkhash 需要特殊处理, 因为同一个chunk中, css和js的chunkhash是一样的
        oldHackedHash = oldHash + specialSeparator + extname;
      }
      // 保存hash的map, 替换二级文件中的hash值
      o2nHashMap[oldHackedHash] = newHash;
      const newChunkName = oldChunkName.replace(oldHackedHash, newHash);
      compilation.renameAsset(oldChunkName, newChunkName);
    }
  });

  // Update the content of the rest of the files in the chunk
  chunkFiles
    .filter(file => !isMainFile(file))
    .forEach((file) => {
      Object.keys(o2nHashMap).forEach((old) => {
        const newHash = o2nHashMap[old];
        replaceHashInAsset(assets[file], old, newHash);
      });
    });
}

/**
 * 获取asset对应的旧 hash 值
 *
 * @param {string} hashType hashType 支持 contenthash 和 chunkhash, 默认contenthash
 * @param {*} oldChunkName chunk的名称,包含hash值
 * @param {*} chunk 块
 * @returns
 */
function getOldHash(hashType, oldChunkName, chunk) {
  const extname = path.extname(oldChunkName);
  const extTypeMap = {
    '.js': 'javascript',
    '.css': 'css/mini-extract',
  };
  const typeMap = {
    contenthash: chunk.contentHash[extTypeMap[extname]],
    chunkhash: chunk.renderedHash,
  };

  return typeMap[hashType];
}

/**
 * 将生成文件中的旧hash字符串替换成新的hash字符串
 * @param {chunk} chunk webpack 的块儿
 * @param {Array<Asset>} assets webpack中的生成文件
 */
function replaceOldHashForNewInChunkFiles(chunk, assets) {
  // 遍历所有chunk相关文件
  Array.from(chunk.files).forEach((file) => {
    // if (file.indexOf('manifest') >= 0) {
    //   console.log(assets[file].source());
    // }
    Object.keys(o2nHashMap).forEach((oldHash) => {
      const newHash = o2nHashMap[oldHash];
      // 只对css和js相关文件的asset进行hash字符串替换,图片什么的不需要
      replaceHashInAsset(assets[file], oldHash, newHash);
    });
  });
}

class ReHashPlugin {
  constructor(options = { hashType: 'chunkhash' }) {
    this.options = { ...options };
  }

  apply(compiler) {
    const pluginName = ReHashPlugin.name;
    const { webpack } = compiler;
    const { Compilation } = webpack;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      // 在特定阶段进入生成文件处理流水线
      compilation.hooks.processAssets.tapAsync(
        {
          name: pluginName,
          // 使用后期处理生成文件的阶段之一，来确保所有生成文件都已经被其他插件添加到 compilation 中
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        /**
         * 钩入处理文件的过程
         * @param {WebpackCompilation} compilationAssets
         * @param {(err?: Error) => void} callback
         */
        (compilationAssets, callback) => {
          const {
            chunks,
            assets,
          } = compilation;

          const sortedChunks = Array.from(chunks).sort((aChunk, bChunk) => {
            const aEntry = aChunk.hasRuntime();
            const bEntry = bChunk.hasRuntime();
            if (aEntry && !bEntry) return 1;
            if (!aEntry && bEntry) return -1;
            return sortChunksById(aChunk, bChunk);
          });

          sortedChunks.forEach((chunk) => {
            replaceOldHashForNewInChunkFiles(chunk, assets);
            reHashChunk(chunk, assets, compilation, this.options.hashType);
          });

          callback();
        },
      );
    });
  }
  static specialSeparator = specialSeparator;
}

function sortChunksById(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

module.exports = ReHashPlugin;
