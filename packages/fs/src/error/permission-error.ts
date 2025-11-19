/**
 * Error thrown when an operation is not permitted due to insufficient privileges
 * or other access control restrictions.
 * @example
 * ```javascript
 * import { PermissionError } from "@visulima/fs/error";
 * import { writeFile } from "@visulima/fs"; // Or any function that might throw this
 * import { join } from "node:path";
 *
 * const tryWritingToProtectedFile = async () => {
 *   const filePath = join("/root", "protected-file.txt"); // A path that typically requires root privileges
 *   try {
 *     // Forcing the scenario for demonstration, as writeFile itself would throw this.
 *     const simulatePermissionError = (path) => {
 *        if (path === filePath) {
 *           throw new PermissionError(`open '${filePath}'`);
 *        }
 *     }
 *     simulatePermissionError(filePath);
 *     // await writeFile(filePath, "test content");
 *   } catch (error) {
 *     if (error instanceof PermissionError) {
 *       console.error(`Operation not permitted: ${error.message}`);
 *       console.error(`Error code: ${error.code}`); // EPERM
 *     } else {
 *       console.error("An unexpected error occurred:", error);
 *     }
 *   }
 * };
 *
 * tryWritingToProtectedFile();
 * ```
 */
class PermissionError extends Error {
    /**
     * Creates a new instance.
     * @param message
     */
    public constructor(message: string) {
        super(`EPERM: Operation not permitted, ${message}`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "EPERM";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EPERM");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "PermissionError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of PermissionError");
    }
}

export default PermissionError;
