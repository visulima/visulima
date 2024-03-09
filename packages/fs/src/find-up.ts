import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import toPath from "./utils/to-path";

const findUp = async (
    name: string,
    options: {
        cwd?: URL | string;
        stopAt?: URL | string;
        type?: "directory" | "file";
    } = {},
): Promise<string | undefined> => {
    let directory = resolve(options.cwd ? toPath(options.cwd) : process.cwd());
    const { root } = parse(directory);
    const stopAt = resolve(directory, toPath(options.stopAt ?? root));

    const type = options.type ?? "file";

    // eslint-disable-next-line no-loops/no-loops
    while (directory && directory !== stopAt && directory !== root) {
        const filePath = isAbsolute(name) ? name : join(directory, name);

        try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const stats = await stat(filePath); // eslint-disable-line no-await-in-loop

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

export default findUp;
