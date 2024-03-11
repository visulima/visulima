import { access } from "node:fs/promises";

import { F_OK } from "./constants";
import toPath from "./utils/to-path";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";

/** Returns a Promise that resolves to a boolean indicating if the path is accessible or not. */
async function isAccessible(path: URL | string, mode?: number): Promise<boolean>;
// eslint-disable-next-line func-style
async function isAccessible(path: URL | string, mode: number = F_OK): Promise<boolean> {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    try {
        await access(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessible;
