import { parse } from "yaml";

import type { ReadYamlOptions, YamlReviver } from "../types";
import readFileSync from "./read-file-sync";

function readYamlSync<R = Record<string, unknown>>(path: URL | string, options?: ReadYamlOptions<"brotli" | "gzip" | "none">): R;
function readYamlSync<R = Record<string, unknown>>(path: URL | string, reviver?: YamlReviver, options?: ReadYamlOptions<"brotli" | "gzip" | "none">): R;

/**
 * Synchronously reads a YAML file and then parses it into an object.
 * @template R The expected type of the parsed YAML object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the YAML file to read. Can be a file URL or a string path.
 * @param reviver An optional reviver function (similar to `JSON.parse` reviver) or the options object.
 * @param options Optional configuration for reading and parsing the YAML file. See {@link ReadYamlOptions}.
 * If `reviver` is an object, this argument is ignored.
 * @returns The parsed YAML object of type `R`.
 * @example
 * ```javascript
 * import { readYamlSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * try {
 *   const data = readYamlSync(join("path", "to", "my-config.yaml"));
 *   console.log("Config data:", data);
 *
 *   // With a reviver function
 *   const dataWithReviver = readYamlSync(join("path", "to", "another.yaml"), (key, value) => {
 *     if (key === "date") return new Date(value);
 *     return value;
 *   });
 *   console.log("Date field is now a Date object:", dataWithReviver.date);
 *
 *   // With options (e.g., for schema validation - assuming yaml options are passed correctly)
 *   // const dataWithOptions = readYamlSync(join("path", "to", "options.yaml"), { schema: 'failsafe' });
 *   // console.log(dataWithOptions);
 *
 * } catch (error) {
 *   console.error("Failed to read or parse YAML file:", error);
 * }
 * ```
 */

function readYamlSync<R = Record<string, unknown>>(
    path: URL | string,

    reviver?: ReadYamlOptions<"brotli" | "gzip" | "none"> | YamlReviver,
    options?: ReadYamlOptions<"brotli" | "gzip" | "none">,
): R {
    const { buffer, compression, encoding = "utf8", flag, ...parseOptions } = options ?? {};

    const content = readFileSync(path, { buffer, compression, encoding, flag });

    return (typeof reviver === "function" ? parse(content, reviver, parseOptions) : parse(content, parseOptions)) as R;
}

export default readYamlSync;
