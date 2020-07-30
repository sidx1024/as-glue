"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.joinStrings = joinStrings;

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

function joinStrings(arr) {
  const arrPtr = arr.map(string => __retain(__allocString(arr)));

  const retPtr = _exports2.joinStrings(arrPtr);

  const retValue = __getString(retPtr);

  __release(arrPtr);

  return retValue;
}
