import { stringify } from "smol-toml";

import type { WriteTomlOptions } from "../types";
import writeFile from "./write-file";

/**
 * Asynchronously writes an object to a TOML file.
 * @param path The path to the TOML file to write. Can be a file URL or a string path.
 * @param data The data to serialize. Must be a plain object compatible with `smol-toml.stringify`.
 * @param options Optional configuration for writing the TOML file. See {@link WriteTomlOptions}.
 * @returns A promise that resolves when the TOML file has been written.
 * @example
 * ```javascript
 * import { writeToml } from "@visulima/fs/toml";
 * import { join } from "node:path";
 *
 * await writeToml(join("/tmp", "config.toml"), { name: "app", version: 1 });
 * ```
 */
const writeToml = async (path: URL | string, data: Record<string, unknown>, options?: WriteTomlOptions): Promise<void> => {
    await writeFile(path, stringify(data), options);
};

export default writeToml;
