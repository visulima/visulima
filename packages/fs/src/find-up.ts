import { stat } from "node:fs/promises";
import { dirname, isAbsolute, parse, resolve } from "node:path";

import { FIND_UP_STOP } from "./constants";
import type { FindUpOptions, Match } from "./types";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

const findUp = async (
    name: ReadonlyArray<string> | string[] | string | ((directory: string) => Match | Promise<Match>),
    options: FindUpOptions = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<string | undefined> => {
    if (typeof name !== "string" && !Array.isArray(name) && typeof name !== "function") {
        throw new TypeError("The `name` argument must be of type `string` or `string[]`");
    }

    const cwd = options.cwd ? toPath(options.cwd) : process.cwd();

    assertValidFileOrDirectoryPath(cwd);

    let directory = resolve(cwd);

    const { root } = parse(directory);
    const stopPath = toPath(options.stopAt ?? root);

    assertValidFileOrDirectoryPath(stopPath);

    const stopAt = resolve(directory, stopPath);
    const type = options.type ?? "file";

    const getMatchers = async function (currentDirectory: string): Promise<(string | typeof FIND_UP_STOP | undefined)[]> {
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

    // eslint-disable-next-line no-loops/no-loops
    while (directory && directory !== stopAt && directory !== root) {
        // eslint-disable-next-line no-await-in-loop,no-loops/no-loops,no-restricted-syntax
        for await (const fileName of await getMatchers(directory)) {
            if (fileName === FIND_UP_STOP) {
                return undefined;
            }

            if (fileName === undefined) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const filePath = isAbsolute(fileName) ? fileName : resolve(directory, fileName);

            try {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                const stats = await stat(filePath);

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
