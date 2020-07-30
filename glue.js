let __allocString, __allocArray, __getString, __getArray, __retain, __release, exports

export default function(_exports) {
  __allocString = _exports.__allocString
  __allocArray = _exports.__allocArray
  __getString = _exports.__getString
  __getArray = _exports.__getArray
  __retain = _exports.__retain
  __release = _exports.__release
  exports = _exports
}

export function joinStrings(arr) {
  const arrPtr = arr.map(string => __retain(__allocString(arr)));
  const retPtr = exports.joinStrings(arrPtr);

  const retValue = __getString(retPtr);

  __release(arrPtr);

  return retValue;
}