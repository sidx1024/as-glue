const fs = require('fs')
const loader = require('@assemblyscript/loader')
const imports = {
  /* imports go here */
}
const glue = require('./glue.cjs.js')
const wasmModule = loader
  .instantiate(fs.readFileSync(__dirname + '/build/untouched.wasm'), imports)
  .then(({ exports }) => {
    const {
      __allocString,
      __allocArray,
      __getString,
      __getArray,
      __retain,
      __release,
    } = exports

    glue.default(exports)

    if (glue.concat) {
      console.log(glue.concat('gl', 'ue'))
    }

    function doSum(values) {
      const arrPtr = __retain(__allocArray(exports.Int32Array_ID, values))
      const value = exports.sum(arrPtr)
      __release(arrPtr)
      return value
    }

    if (glue.sum) {
      console.log(glue.sum([1, 2, 3, 4]))
    }

    if (glue.joinStrings) {
      console.log(
        glue.joinStrings([
          ['g', 'l', 'ue'],
          ['sti', 'ck'],
        ])
      )
    }

    //console.log(doSum([1, 2]))
  })
module.exports = wasmModule.exports
