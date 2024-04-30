import path from "node:path";

import { isAbsolutePath, isRelativePath, normalizePath } from "./path";

export const isModule = (url: string): boolean => /^~[\d@A-Z]/i.test(url);

export function getUrlOfPartial(url: string): string {
    const { base, dir } = path.parse(url);

    return dir ? `${normalizePath(dir)}/_${base}` : `_${base}`;
}

export function normalizeUrl(url: string): string {
    if (isModule(url)) {
        return normalizePath(url.slice(1));
    }

    if (isAbsolutePath(url) || isRelativePath(url)) {
        return normalizePath(url);
    }

    return `./${normalizePath(url)}`;
}
