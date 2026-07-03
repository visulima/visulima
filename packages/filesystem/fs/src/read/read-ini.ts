import { parse } from "ini";

import type { CompressionType, ReadIniOptions } from "../types";
import readFile from "./read-file";

/**
 * Asynchronously reads an INI file and parses it into an object.
 * @template R The expected type of the parsed object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the INI file. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link ReadIniOptions}.
 * @returns A promise that resolves with the parsed object.
 * @example
 * ```javascript
 * import { readIni } from "@visulima/fs/ini";
 *
 * const config = await readIni("./config.ini");
 * ```
 */
const readIni = async <R = Record<string, unknown>>(path: URL | string, options?: ReadIniOptions<CompressionType>): Promise<R> => {
    const { bracketedArray = true, ...readOptions } = options ?? {};
    const content = await readFile(path, { encoding: "utf8", ...readOptions });

    return parse(content, { bracketedArray }) as R;
};

export default readIni;
