/**
 * Asserts that the provided path is a valid file or directory path.
 * A valid path must be a non-empty string or a URL instance.
 *
 * @param fileOrDirectoryPath The path to validate.
 * @throws {TypeError} If the path is not a non-empty string or a URL.
 * @example
 * ```javascript
 * import { assertValidFileOrDirectoryPath } from "@visulima/fs"; // Assuming this util is exported
 *
 * try {
 *   assertValidFileOrDirectoryPath("/path/to/file.txt");
 *   assertValidFileOrDirectoryPath(new URL("file:///path/to/file.txt"));
 *   console.log("Path is valid.");
 * } catch (error) {
 *   console.error(error.message); // Path must be a non-empty string or URL.
 * }
 *
 * try {
 *   assertValidFileOrDirectoryPath(""); // Invalid path
 * } catch (error) {
 *   console.error(error.message); // Path must be a non-empty string or URL.
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
const assertValidFileOrDirectoryPath = (fileOrDirectoryPath: any): void => {
    if (!fileOrDirectoryPath || (!(fileOrDirectoryPath instanceof URL) && typeof fileOrDirectoryPath !== "string")) {
        throw new TypeError("Path must be a non-empty string or URL.");
    }
};

export default assertValidFileOrDirectoryPath;
