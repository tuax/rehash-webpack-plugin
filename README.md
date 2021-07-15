<div align="center">
  <span style = "font-size:50px; display:inline-block; position:relative; top:-80px;">REHASH</span>
  <a style="display: inline-block;" href="https://github.com/webpack/webpack">
    <img width="200" height="200"
      src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
  <div style="margin-top: -60px;">
    <img width="100" height="100" title="Webpack Plugin" src="http://michael-ciniawsky.github.io/postcss-load-plugins/logo.svg">
  </div>
  <h1>REHASH Webpack Plugin</h1>
  <p>Real contenthash for emitted assets in webpack5. </p>
</div>

<h2 align="center">Install</h2>
<h3>Webpack 5</h3>

```bash
  npm i -D rehash-webpack-plugin
```

```bash
  yarn add --dev rehash-webpack-plugin
```

Then, you can easily rename the emitted JS/CSS file using its md5 value.

<h2 align="center">Usage</h2>

The plugin will calculate the hash value based on the final webpack emitted assets' content, replacing the contenthash or chunkhash in the JS/CSS filename. Just follow these steps:

### add the plugin to your `webpack`

Check and modify your webpack configuration files as appropriate
Depending on whether the production environment exports sourcemap files or not, there are two recommended ways to set this up.

#### devtool is set to none of the `source-map`, `nosources-source-map`, `hidden-nosources-source-map`, `hidden-source-map`

for main configurations,

```js
import RehashWebpackPlugin from 'rehash-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

module.exports = {
  devtool: false,
  // ... Ignore other configurations ...
  output: {
    filename: '[contenthash].js',
     // for dynamic chunk
    chunkFilename: '[contenthash].js',
    hashFunction: 'md5',
    hashDigest: 'hex'
  },
  plugins: [
    new RehashWebpackPlugin({hashType:'contenthash'}),
    new MiniCssExtractPlugin({
        filename: '[contenthash].css',
        // for dynamic chunk
        chunkFilename: '[contenthash].css', 
    })
  ]
}
```
> Note: ** All the files will be rename with the new hash. **

#### devtool is set to one of the `source-map`, `nosources-source-map`, `hidden-nosources-source-map`, `hidden-source-map`

In this case, the production environment generates a sourcemap file for the JS/CSS files, and `output` needs to be configured with the following `filename` and `chunkFilename`
```js
import RehashWebpackPlugin from 'rehash-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

module.exports = {
  devtool: 'source-map',
  // ... Ignore other configurations ...
  output: {
    filename: `[chunkhash]${RehashWebpackPlugin.specialSeparator}.js.js`,
     // for dynamic chunk
    chunkFilename: '[contenthash].js',
    hashFunction: 'md5',
    hashDigest: 'hex'
  },
  plugins: [
    new RehashWebpackPlugin({hashType:'chunkhash'}),
    new MiniCssExtractPlugin({
        filename:  `[chunkhash]${RehashWebpackPlugin.specialSeparator}.css.css`,
        // for dynamic chunk
        chunkFilename: '[contenthash].css', 
    })
  ]
}
```

> Note: ** Only the main file(not including the dynamic file) will be renamed with the new hash. **

This is because if `contenthash` is also used in the `output.filename` configuration, this causes the sourcemap filename to be modified once during the processAssets phase, and the hash value generated based on the contents of the file in the intermediate state is not the correct hash value.


<h2 align="center">Options</h2>

### options.hashType
`string`, `contenthash` | `chunkhash`, default to `chunkhash`

> Note: This setting depends on whether the sourcemap file will be generated. See above.

## Contributors

KnightWu (@wulijian)
wulijian722@gmail.com


## Special Notes

This plugin is partial based on [webpack-plugin-hash-output](https://github.com/scinos/webpack-plugin-hash-output), thanks for their work.