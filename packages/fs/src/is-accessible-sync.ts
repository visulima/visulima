import { accessSync } from "node:fs";

import { F_OK } from "./constants";

/** Returns a boolean indicating if the path is accessible or not. */
function isAccessibleSync(path: string, mode?: number): boolean;
// eslint-disable-next-line func-style
function isAccessibleSync(path: string, mode: number = F_OK): boolean[] | boolean {
    try {
        accessSync(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessibleSync;
