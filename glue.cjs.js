"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.concat = concat;

let __allocString, __allocArray, __getString, __getArray, __retain, __release, _exports2;

function _default(_exports) {
  __allocString = _exports.__allocString;
  __allocArray = _exports.__allocArray;
  __getString = _exports.__getString;
  __getArray = _exports.__getArray;
  __retain = _exports.__retain;
  __release = _exports.__release;
  _exports2 = _exports;
}

function concat(a, b) {
  const aPtr = __retain(__allocString(a));

  const bPtr = __retain(__allocString(b));

  const cPtr = _exports2.concat(aPtr, bPtr);

  const c = __getString(cPtr);

  __release(aPtr);

  __release(bPtr);

  __release(cPtr);

  return c;
}
