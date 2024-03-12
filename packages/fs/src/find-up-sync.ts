import { statSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import type { FindUpOptions } from "./types";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

const findUpSync = (
    name: string[] | string,
    options: FindUpOptions = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string[] | string | undefined => {
    if (typeof name !== "string" && !Array.isArray(name)) {
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

    const search = typeof name === "string" ? [name] : name;
    const matches: string[] = [];

    // eslint-disable-next-line no-loops/no-loops
    while (directory && directory !== stopAt && directory !== root) {
        for (const fileName of search) {
            const filePath = isAbsolute(fileName) ? fileName : join(directory, fileName);

            try {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                const stats = statSync(filePath);

                if ((type === "file" && stats.isFile()) || (type === "directory" && stats.isDirectory())) {
                    matches.push(filePath);
                }
            } catch {
                /* empty */
            }
        }

        directory = dirname(directory);
    }

    if (matches.length > 0) {
        if (typeof name === "string") {
            return matches[0];
        }

        return matches;
    }

    return undefined;
};

export default findUpSync;
