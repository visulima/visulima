import { parse } from "smol-toml";

import type { CompressionType, ReadTomlOptions } from "../types";
import readFile from "./read-file";

/**
 * Asynchronously reads a TOML file and parses it into an object.
 * @template R The expected type of the parsed TOML object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the TOML file to read. Can be a file URL or a string path.
 * @param options Optional configuration for reading the file. See {@link ReadTomlOptions}.
 * @returns A promise that resolves with the parsed TOML object of type `R`.
 * @example
 * ```javascript
 * import { readToml } from "@visulima/fs/toml";
 * import { join } from "node:path";
 *
 * const config = await readToml(join("path", "to", "config.toml"));
 * ```
 */
const readToml = async <R = Record<string, unknown>>(path: URL | string, options?: ReadTomlOptions<CompressionType>): Promise<R> => {
    const content = await readFile(path, { encoding: "utf8", ...options });

    return parse(content) as R;
};

export default readToml;
