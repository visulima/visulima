/**
 * Error thrown when a file or directory already exists at a specified path, and an operation was expecting it not to.
 * @example
 * ```javascript
 * import { AlreadyExistsError } from "@visulima/fs/error"; // Assuming it's exported from an index or directly
 * import { ensureSymlinkSync } from "@visulima/fs"; // Or any function that might throw this
 * import { join } from "node:path";
 *
 * try {
 *   // Example: ensureSymlinkSync might throw this if a file (not a symlink) already exists at linkName
 *   // For demonstration, let's assume someFunction internally throws it:
 *   const someFunctionThatMightThrow = (path) => {
 *      if (path === "/tmp/existing-file.txt") { // Simulate a check
 *          throw new AlreadyExistsError(`file already exists at '/tmp/existing-file.txt'`);
 *      }
 *   }
 *   someFunctionThatMightThrow("/tmp/existing-file.txt");
 * } catch (error) {
 *   if (error instanceof AlreadyExistsError) {
 *     console.error(`Operation failed because path exists: ${error.message}`);
 *     console.error(`Error code: ${error.code}`); // EEXIST
 *   } else {
 *     console.error("An unexpected error occurred:", error);
 *   }
 * }
 * ```
 */
class AlreadyExistsError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EEXIST: ${message}`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "EEXIST";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EEXIST");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "AlreadyExistsError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of AlreadyExistsError");
    }
}

export default AlreadyExistsError;
