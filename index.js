const fs = require("fs");
const loader = require("@assemblyscript/loader");
const imports = { /* imports go here */ };
const glue = require("./glue.cjs.js");
const wasmModule = loader
  .instantiate(
    fs.readFileSync(__dirname + '/build/untouched.wasm'),
    imports
  )
  .then(({ exports }) => {
    glue.default(exports)
    console.log(glue.concat("gl", "ue"))
  })
module.exports = wasmModule.exports;
