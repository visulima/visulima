import { access } from "node:fs/promises";

import { F_OK } from "./constants";

/** Returns a Promise that resolves to a boolean indicating if the path is accessible or not. */
// eslint-disable-next-line func-style
async function isAccessible(path: string, mode: number = F_OK): Promise<boolean[] | boolean> {
    try {
        await access(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessible;
