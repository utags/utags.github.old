/**
 * Converts a JavaScript value to a JSON string, formatted for readability.
 * Uses a 2-space indentation for pretty printing.
 *
 * @param value - The value, usually an object or array, to be converted.
 * @returns A JSON string representing the value, or undefined if the value cannot be stringified.
 */
export function prettyPrintJson(value: any): string {
  return JSON.stringify(value, null, 2)
}
// TODO: sort bookmarks by created
// prettyPrintJsonWithSorted
