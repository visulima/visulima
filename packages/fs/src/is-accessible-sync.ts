import { accessSync } from "node:fs";

import { F_OK } from "./constants";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

/** Returns a boolean indicating if the path is accessible or not. */
function isAccessibleSync(path: URL | string, mode?: number): boolean;
// eslint-disable-next-line func-style
function isAccessibleSync(path: URL | string, mode: number = F_OK): boolean {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    try {
        accessSync(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessibleSync;
