import type { WalkOptions } from "../types";
import walkSync from "./walk-sync";

/**
 * Synchronously collects all file paths within a directory that match the specified criteria.
 * By default, it searches for JavaScript and TypeScript file extensions.
 *
 * @param directory The root directory to start collecting files from.
 * @param options Optional configuration to control the collection process. See {@link WalkOptions}.
 * @returns An array of absolute file paths.
 * @example
 * ```javascript
 * import { collectSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // Collect all .txt and .md files in /tmp/docs, up to 2 levels deep
 * const files = collectSync(join("/tmp", "docs"), {
 *   extensions: ["txt", "md"],
 *   maxDepth: 2,
 *   includeDirs: false, // Only collect files
 * });
 * console.log(files);
 * // Example output: ['/tmp/docs/file1.txt', '/tmp/docs/subdir/report.md']
 *
 * // Collect all .js files, excluding anything in node_modules
 * const jsFiles = collectSync(join("/tmp", "project"), {
 *   extensions: ["js"],
 *   skip: [/node_modules/],
 * });
 * console.log(jsFiles);
 * ```
 */
const collectSync = (directory: string, options: WalkOptions = {}): string[] => {
    if (!Array.isArray(options.extensions)) {
        // eslint-disable-next-line no-param-reassign
        options.extensions = ["js", "mjs", "cjs", "ts"];
    }

    const entries: string[] = [];

    // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
    for (const entry of walkSync(directory, options)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collectSync;
