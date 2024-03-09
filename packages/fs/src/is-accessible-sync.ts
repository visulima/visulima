import { accessSync } from "node:fs";

import { F_OK } from "./constants";

/** Returns a boolean indicating if the path is accessible or not. */
function isAccessibleSync(path: string, mode?: number): boolean;
function isAccessibleSync(path: string[], mode?: number): boolean[];
// eslint-disable-next-line func-style
function isAccessibleSync(path: string[] | string, mode: number = F_OK): boolean[] | boolean {
    if (Array.isArray(path)) {
        return path.map((index) => isAccessibleSync(index, mode));
    }

    try {
        accessSync(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessibleSync;
