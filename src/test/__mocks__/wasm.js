const fs = require('fs');
const path = require('path');

module.exports = new Uint8Array(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'wasm', 'diffsol_c.wasm'))
);