import { parse } from "ini";

import type { CompressionType, ReadIniOptions } from "../types";
import readFileSync from "./read-file-sync";

/**
 * Synchronously reads an INI file and parses it into an object.
 * @template R The expected type of the parsed object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the INI file. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link ReadIniOptions}.
 * @returns The parsed object.
 * @example
 * ```javascript
 * import { readIniSync } from "@visulima/fs/ini";
 *
 * const config = readIniSync("./config.ini");
 * ```
 */
const readIniSync = (path: URL | string, options?: ReadIniOptions<CompressionType>): Record<string, unknown> => {
    const { bracketedArray = true, ...readOptions } = options ?? {};
    const content = readFileSync(path, { encoding: "utf8", ...readOptions });

    return parse(content, { bracketedArray });
};

export default readIniSync;
