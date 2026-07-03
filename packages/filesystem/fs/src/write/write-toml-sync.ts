import { stringify } from "smol-toml";

import type { WriteTomlOptions } from "../types";
import writeFileSync from "./write-file-sync";

/**
 * Synchronously writes an object to a TOML file.
 * @param path The path to the TOML file to write. Can be a file URL or a string path.
 * @param data The data to serialize. Must be a plain object compatible with `smol-toml.stringify`.
 * @param options Optional configuration for writing the TOML file. See {@link WriteTomlOptions}.
 * @example
 * ```javascript
 * import { writeTomlSync } from "@visulima/fs/toml";
 * import { join } from "node:path";
 *
 * writeTomlSync(join("/tmp", "config.toml"), { name: "app", version: 1 });
 * ```
 */
const writeTomlSync = (path: URL | string, data: Record<string, unknown>, options?: WriteTomlOptions): void => {
    writeFileSync(path, stringify(data), options);
};

export default writeTomlSync;
