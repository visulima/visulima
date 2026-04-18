import { parse } from "smol-toml";

import type { CompressionType, ReadTomlOptions } from "../types";
import readFileSync from "./read-file-sync";

/**
 * Synchronously reads a TOML file and parses it into an object.
 * @template R The expected type of the parsed TOML object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the TOML file to read. Can be a file URL or a string path.
 * @param options Optional configuration for reading the file. See {@link ReadTomlOptions}.
 * @returns The parsed TOML object of type `R`.
 * @example
 * ```javascript
 * import { readTomlSync } from "@visulima/fs/toml";
 * import { join } from "node:path";
 *
 * const config = readTomlSync(join("path", "to", "config.toml"));
 * ```
 */
const readTomlSync = (path: URL | string, options?: ReadTomlOptions<CompressionType>): Record<string, unknown> => {
    const content = readFileSync(path, { encoding: "utf8", ...options });

    return parse(content);
};

export default readTomlSync;
