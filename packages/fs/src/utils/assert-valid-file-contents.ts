/**
 * Asserts that the provided contents are valid for writing to a file.
 * Valid contents can be a string, an ArrayBuffer, or an ArrayBuffer view (e.g., Uint8Array).
 *
 * @param contents The file contents to validate.
 * @throws {TypeError} If the contents are not a string, ArrayBuffer, or ArrayBuffer view.
 * @example
 * ```javascript
 * import { assertValidFileContents } from "@visulima/fs"; // Assuming this util is exported
 *
 * try {
 *   assertValidFileContents("Hello, world!");
 *   assertValidFileContents(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
 *   assertValidFileContents(new ArrayBuffer(8));
 *   console.log("File contents are valid.");
 * } catch (error) {
 *   console.error(error.message); // File contents must be a string, ArrayBuffer, or ArrayBuffer view.
 * }
 *
 * try {
 *   assertValidFileContents(123); // Invalid content type
 * } catch (error) {
 *   console.error(error.message); // File contents must be a string, ArrayBuffer, or ArrayBuffer view.
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
const assertValidFileContents = (contents: any): void => {
    if (typeof contents !== "string" && !(contents instanceof ArrayBuffer) && !ArrayBuffer.isView(contents)) {
        throw new TypeError("File contents must be a string, ArrayBuffer, or ArrayBuffer view.");
    }
};

export default assertValidFileContents;
