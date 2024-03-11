import { statSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import type { FindUpOptions } from "./types";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

const findUpSync = (
    name: string,
    options: FindUpOptions = {},
): string | undefined => {
    const cwd = options.cwd ? toPath(options.cwd) : process.cwd();

    assertValidFileOrDirectoryPath(cwd);

    let directory = resolve(cwd);

    const { root } = parse(directory);
    const stopPath = toPath(options.stopAt ?? root);

    assertValidFileOrDirectoryPath(stopPath);

    const stopAt = resolve(directory, stopPath);
    const type = options.type ?? "file";

    // eslint-disable-next-line no-loops/no-loops
    while (directory && directory !== stopAt && directory !== root) {
        const filePath = isAbsolute(name) ? name : join(directory, name);

        try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const stats = statSync(filePath);

            if ((type === "file" && stats.isFile()) || (type === "directory" && stats.isDirectory())) {
                return filePath;
            }
        } catch {
            /* empty */
        }

        directory = dirname(directory);
    }

    return undefined;
};

export default findUpSync;
