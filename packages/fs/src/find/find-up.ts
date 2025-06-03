import type { PathLike } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { dirname, isAbsolute, parse, resolve } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { FIND_UP_STOP } from "../constants";
import type { FindUpName, FindUpOptions } from "../types";

/**
 * Asynchronously finds a file or directory by walking up parent directories.
 *
 * @param name The name(s) of the file or directory to find. Can be a string, an array of strings, or a function that returns a name or `FIND_UP_STOP`.
 * @param options Optional configuration for the search. See {@link FindUpOptions}.
 * @returns A promise that resolves to the absolute path of the first found file/directory, or `undefined` if not found.
 * @example
 * ```javascript
 * import { findUp } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const findProjectRoot = async () => {
 *   // Find the closest package.json, starting from /tmp/foo/bar/baz
 *   const projectRoot = await findUp("package.json", {
 *     cwd: join("/tmp", "foo", "bar", "baz"),
 *     type: "file",
 *   });
 *   console.log(projectRoot); // e.g., /tmp/foo/package.json or undefined
 *
 *   // Find the closest .git directory or a README.md file
 *   const gitDirOrReadme = await findUp([".git", "README.md"], {
 *     cwd: join("/tmp", "foo", "bar"),
 *   });
 *   console.log(gitDirOrReadme);
 *
 *   // Find using a custom function, stopping at /tmp
 *   const customFound = await findUp(
 *     (directory) => {
 *       if (directory === join("/tmp", "foo")) {
 *         return "found-it-here.txt"; // Pretend this file exists in /tmp/foo
 *       }
 *       return undefined;
 *     },
 *     {
 *       cwd: join("/tmp", "foo", "bar", "baz"),
 *       stopAt: join("/tmp"),
 *     }
 *   );
 *   console.log(customFound);
 * };
 *
 * findProjectRoot();
 * ```
 */
const findUp = async (
    name: FindUpName,
    options: FindUpOptions = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<string | undefined> => {
    if (typeof name !== "string" && !Array.isArray(name) && typeof name !== "function") {
        throw new TypeError("The `name` argument must be of type `string` or `string[]`");
    }

    const cwd = options.cwd ? toPath(options.cwd) : process.cwd();

    let directory = resolve(cwd);

    const { root } = parse(directory);
    const stopPath = toPath(options.stopAt ?? root);

    const stopAt = resolve(directory, stopPath);
    const type = options.type ?? "file";

    const getMatchers = async function (currentDirectory: string): Promise<(PathLike | typeof FIND_UP_STOP | undefined)[]> {
        if (typeof name === "function") {
            const match = await name(currentDirectory);

            return [match];
        }

        if (typeof name === "string") {
            return [name];
        }

        if (Array.isArray(name)) {
            return name as string[];
        }

        return [name];
    };

    if (options.allowSymlinks === undefined) {
        // eslint-disable-next-line no-param-reassign
        options.allowSymlinks = true;
    }

    const statFunction = options.allowSymlinks ? stat : lstat;

    // eslint-disable-next-line no-loops/no-loops
    while (directory && directory !== stopAt && directory !== root) {
        // eslint-disable-next-line no-await-in-loop,no-loops/no-loops,no-restricted-syntax
        for await (let fileName of await getMatchers(directory)) {
            if (fileName === FIND_UP_STOP) {
                return undefined;
            }

            if (fileName === undefined) {
                // eslint-disable-next-line no-continue
                continue;
            }

            if (Buffer.isBuffer(fileName)) {
                fileName = fileName.toString();
            } else if (fileName instanceof URL) {
                fileName = fileURLToPath(fileName as URL | string);
            }

            const filePath = isAbsolute(fileName as string) ? (fileName as string) : resolve(directory, fileName as string);

            try {
                const stats = await statFunction(filePath);

                if ((type === "file" && stats.isFile()) || (type === "directory" && stats.isDirectory())) {
                    return filePath;
                }
            } catch {
                /* empty */
            }
        }

        directory = dirname(directory);
    }

    return undefined;
};

export default findUp;
