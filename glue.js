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

export function concat(a, b) {
  const aPtr = __retain(__allocString(a));

  const bPtr = __retain(__allocString(b));

  const cPtr = exports.concat(aPtr, bPtr);

  const c = __getString(cPtr);

  __release(aPtr);

  __release(bPtr);

  __release(cPtr);

  return c;
}