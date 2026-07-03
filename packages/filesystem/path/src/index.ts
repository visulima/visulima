import type NodePath from "node:path";

// eslint-disable-next-line import/no-namespace
import * as path from "./path";

export {
    basename,
    delimiter,
    dirname,
    extname,
    format,
    isAbsolute,
    join,
    matchesGlob,
    normalize,
    normalizeString,
    parse,
    relative,
    resolve,
    sep,
    toNamespacedPath,
} from "./path";

export type Path = Omit<typeof NodePath, "posix" | "win32">;

export const posix: Path = path;
export const win32: Path = path;

export default path as unknown as Path;
