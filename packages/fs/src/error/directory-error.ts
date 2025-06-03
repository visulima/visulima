/**
 * Error thrown when an operation that is not allowed on a directory is attempted.
 * This typically occurs when a file-specific operation is used on a directory path.
 * @example
 * ```javascript
 * import { DirectoryError } from "@visulima/fs/error";
 * import { readFile } from "@visulima/fs"; // Or any function that might throw this
 * import { join } from "node:path";
 *
 * const attemptToReadFileFromDir = async () => {
 *   try {
 *     // Attempting to read a directory as if it were a file
 *     // This is a conceptual example; readFile might throw a different error first
 *     // depending on its internal checks, but EISDIR is the underlying system error.
 *     // Forcing the scenario:
 *     const pretendReadFileOnDir = (path) => {
 *       if (path === "/tmp/my-directory") { // Simulate a directory path
 *         throw new DirectoryError(`read '/tmp/my-directory'`);
 *       }
 *     }
 *     pretendReadFileOnDir("/tmp/my-directory");
 *     // await readFile(join("/tmp", "my-directory"));
 *   } catch (error) {
 *     if (error instanceof DirectoryError) {
 *       console.error(`Operation failed, path is a directory: ${error.message}`);
 *       console.error(`Error code: ${error.code}`); // EISDIR
 *     } else {
 *       console.error("An unexpected error occurred:", error);
 *     }
 *   }
 * };
 *
 * attemptToReadFileFromDir();
 * ```
 */
class DirectoryError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EISDIR: Illegal operation on a directory, ${message}`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "EISDIR";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EISDIR");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "DirectoryError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of DirectoryError");
    }
}

export default DirectoryError;
