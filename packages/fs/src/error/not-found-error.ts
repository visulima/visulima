/**
 * Error thrown when a file or directory is not found at a specified path.
 * @example
 * ```javascript
 * import { NotFoundError } from "@visulima/fs/error";
 * import { readFile } from "@visulima/fs"; // Or any function that might throw this
 * import { join } from "node:path";
 *
 * const tryReadingNonExistentFile = async () => {
 *   const filePath = join("/tmp", "this-file-does-not-exist.txt");
 *   try {
 *     // Forcing the scenario for demonstration, as readFile itself would throw this.
 *     const simulateNotFound = (path) => {
 *        if (path === filePath) {
 *           throw new NotFoundError(`no such file or directory, open '${filePath}'`);
 *        }
 *     }
 *     simulateNotFound(filePath);
 *     // await readFile(filePath);
 *   } catch (error) {
 *     if (error instanceof NotFoundError) {
 *       console.error(`Operation failed, path not found: ${error.message}`);
 *       console.error(`Error code: ${error.code}`); // ENOENT
 *     } else {
 *       console.error("An unexpected error occurred:", error);
 *     }
 *   }
 * };
 *
 * tryReadingNonExistentFile();
 * ```
 */
class NotFoundError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOENT: ${message}`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "ENOENT";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code ENOENT");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "NotFoundError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of NotFoundError");
    }
}

export default NotFoundError;
