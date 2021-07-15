const path = require('path');
const fs = require('fs');

const src = path.resolve(__dirname, fs.existsSync(path.resolve(__dirname, './src')) ? './src' : './lib');
module.exports = require(`${src}/index`);
