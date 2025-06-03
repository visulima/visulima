/**
 * Error thrown when a directory is not empty.
 * @example
 * ```javascript
 * import { NotEmptyError } from "@visulima/fs/error";
 * import { rmdir } from "node:fs/promises"; // Or any fs function that might throw this system error
 * import { join } from "node:path";
 *
 * const attemptToRemoveNonEmptyDir = async () => {
 *   const dirPath = join("/tmp", "my-non-empty-dir"); // Assume this directory exists and has files
 *   try {
 *     // Forcing the scenario for demonstration, as rmdir might throw its own specific error.
 *     // Node.js fs operations that encounter a non-empty directory when expecting an empty one
 *     // typically throw an error with code ENOTEMPTY.
 *     const simulateNotEmpty = (path) => {
 *       if (path === dirPath) { // Simulate check for non-empty
 *          throw new NotEmptyError(`rmdir '${dirPath}'`);
 *       }
 *     }
 *     simulateNotEmpty(dirPath);
 *     // await rmdir(dirPath); // This would likely throw an error with code ENOTEMPTY
 *   } catch (error) {
 *     if (error instanceof NotEmptyError) {
 *       console.error(`Operation failed, directory is not empty: ${error.message}`);
 *       console.error(`Error code: ${error.code}`); // ENOTEMPTY
 *     } else {
 *       console.error("An unexpected error occurred:", error);
 *     }
 *   }
 * };
 *
 * // You would need to set up a non-empty directory at /tmp/my-non-empty-dir for a real test
 * // import { ensureDirSync, writeFileSync } from "@visulima/fs";
 * // ensureDirSync(dirPath);
 * // writeFileSync(join(dirPath, "somefile.txt"), "content");
 *
 * attemptToRemoveNonEmptyDir();
 * ```
 */
class NotEmptyError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOTEMPTY: Directory not empty, ${message}`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "ENOTEMPTY";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code ENOTEMPTY");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "NotEmptyError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of NotEmptyError");
    }
}

export default NotEmptyError;
