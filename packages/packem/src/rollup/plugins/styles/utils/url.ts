import { parse } from "node:path";

import { isAbsolute, toNamespacedPath } from "pathe";

import { isRelativePath } from "./path";

export const isModule = (url: string): boolean => /^~[\d@A-Z]/i.test(url);

export const getUrlOfPartial = (url: string): string => {
    const { base, dir } = parse(url);

    return dir ? `${toNamespacedPath(dir)}/_${base}` : `_${base}`;
};

export const normalizeUrl = (url: string): string => {
    if (isModule(url)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return toNamespacedPath(url.slice(1));
    }

    if (isAbsolute(url) || isRelativePath(url)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return toNamespacedPath(url);
    }

    return `./${toNamespacedPath(url)}`;
};
