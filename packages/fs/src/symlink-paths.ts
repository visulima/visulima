import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

import toPath from "./utils/to-path";

const symlinkPaths = (
    sourcePath: URL | string,
    destinationPath: URL | string,
): {
    toCwd: string;
    toDestination: string;
} => {
    // eslint-disable-next-line no-param-reassign
    sourcePath = toPath(sourcePath);
    // eslint-disable-next-line no-param-reassign
    destinationPath = toPath(destinationPath);

    if (isAbsolute(sourcePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const exists = existsSync(sourcePath);

        if (!exists) {
            throw new Error("absolute sourcePath does not exist");
        }

        return {
            toCwd: sourcePath,
            toDestination: sourcePath,
        };
    }

    const destinationDirectory = dirname(destinationPath);
    const relativeToDestination = join(destinationDirectory, sourcePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const exists = existsSync(relativeToDestination);

    if (exists) {
        return {
            toCwd: relativeToDestination,
            toDestination: sourcePath,
        };
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sourceExists = existsSync(sourcePath);

    if (!sourceExists) {
        throw new Error("relative sourcePath does not exist");
    }

    return {
        toCwd: sourcePath,
        toDestination: relative(destinationDirectory, sourcePath),
    };
};

export default symlinkPaths;
