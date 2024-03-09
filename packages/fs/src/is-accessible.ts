import { access } from "node:fs/promises";

import { F_OK } from "./constants";

/** Returns a Promise that resolves to a boolean indicating if the path is accessible or not. */
async function isAccessible(path: string, mode?: number): Promise<boolean>;
async function isAccessible(path: string[], mode?: number): Promise<boolean[]>;
// eslint-disable-next-line func-style
async function isAccessible(path: string[] | string, mode: number = F_OK): Promise<boolean[] | boolean> {
    if (Array.isArray(path)) {
        return await Promise.all(path.map(async (index) => await isAccessible(index, mode)));
    }

    try {
        await access(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessible;
