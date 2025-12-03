import type { WalkOptions } from "../types";
import walk from "./walk";

/**
 * Asynchronously collects all file paths within a directory that match the specified criteria.
 * By default, it searches for JavaScript and TypeScript file extensions.
 * @param directory The root directory to start collecting files from.
 * @param options Optional configuration to control the collection process. See {@link WalkOptions}.
 * @returns A promise that resolves to an array of absolute file paths.
 * @example
 * ```javascript
 * import { collect } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const collectFiles = async () => {
 *   // Collect all .txt and .md files in /tmp/docs, up to 2 levels deep
 *   const files = await collect(join("/tmp", "docs"), {
 *     extensions: ["txt", "md"],
 *     maxDepth: 2,
 *     includeDirs: false, // Only collect files
 *   });
 *   console.log(files);
 *   // Example output: ['/tmp/docs/file1.txt', '/tmp/docs/subdir/report.md']
 *
 *   // Collect all .js files, excluding anything in node_modules
 *   const jsFiles = await collect(join("/tmp", "project"), {
 *     extensions: ["js"],
 *     skip: [/node_modules/],
 *   });
 *   console.log(jsFiles);
 * };
 *
 * collectFiles();
 * ```
 */
const collect = async (directory: string, options: WalkOptions = {}): Promise<string[]> => {
    if (!Array.isArray(options.extensions)) {
        // eslint-disable-next-line no-param-reassign
        options.extensions = ["js", "mjs", "cjs", "ts"];
    }

    const entries: string[] = [];

    for await (const entry of walk(directory, options)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collect;
