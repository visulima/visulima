// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.

/**
 * Error thrown in {@linkcode walk} or {@linkcode walkSync} during iteration.
 * @example
 * ```javascript
 * import { WalkError } from "@visulima/fs/error";
 * import { walk } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const processDirectory = async () => {
 *   const dirToWalk = join("/tmp", "non-existent-or-permission-denied-dir");
 *   try {
 *     // Forcing the scenario: walk might throw a WalkError if it encounters an issue
 *     // like a directory it cannot read during the walk process.
 *     const simulateWalkError = async (rootDir) => {
 *       // Let's say readdir inside walk fails for a subdirectory.
 *       const underlyingError = new Error("Permission denied reading subdirectory");
 *       throw new WalkError(underlyingError, rootDir);
 *     }
 *     // This is conceptual. In a real scenario, 'walk' itself would throw.
 *     // for await (const entry of walk(dirToWalk)) {
 *     //   console.log(entry.path);
 *     // }
 *     await simulateWalkError(dirToWalk);
 *   } catch (error) {
 *     if (error instanceof WalkError) {
 *       console.error(`Error during directory walk of "${error.root}": ${error.message}`);
 *       if (error.cause) {
 *         console.error(`Underlying cause: ${error.cause}`);
 *       }
 *     } else {
 *       console.error("An unexpected error occurred:", error);
 *     }
 *   }
 * };
 *
 * processDirectory();
 * ```
 */
class WalkError extends Error {
    /** File path of the root that's being walked. */
    public root: string;

    /**
     * Constructs a new instance.
     * @param cause The underlying error or reason for the walk failure.
     * @param root The root directory path where the walk operation started or encountered the error.
     */
    public constructor(cause: unknown, root: string) {
        super(`${cause instanceof Error ? cause.message : cause} for path "${root}"`);

        this.cause = cause;
        this.root = root;
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "WalkError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of WalkError");
    }
}

export default WalkError;
