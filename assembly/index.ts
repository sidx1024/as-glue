// export function concat(a: string, b: string): string {
//   return a + b
// }
//
// export function sum(arr: Int32Array): Int32Array {
//   let sum = 0
//   for (let i = 0, k = arr.length; i < k; ++i) {
//     sum += unchecked(arr[i])
//   }
//   return arr.reverse()
// }

export function joinStrings(arr: string[][]): string {
  return arr
    .map<string>((p) => p.join(', '))
    .join(', ')
}

export const Int32Array_ID = idof<Int32Array>()
