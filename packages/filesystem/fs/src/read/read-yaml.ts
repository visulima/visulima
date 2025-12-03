import { parse } from "yaml";

import type { CompressionType, ReadYamlOptions, YamlReviver } from "../types";
import readFile from "./read-file";

async function readYaml<R = Record<string, unknown>>(path: URL | string, options?: ReadYamlOptions<CompressionType>): Promise<R>;
async function readYaml<R = Record<string, unknown>>(path: URL | string, reviver?: YamlReviver, options?: ReadYamlOptions<CompressionType>): Promise<R>;

/**
 * Asynchronously reads a YAML file and then parses it into an object.
 * @template R The expected type of the parsed YAML object. Defaults to `Record&lt;string, unknown>`.
 * @param path The path to the YAML file to read. Can be a file URL or a string path.
 * @param reviver An optional reviver function (similar to `JSON.parse` reviver) or the options object.
 * @param options Optional configuration for reading and parsing the YAML file. See {@link ReadYamlOptions}.
 * If `reviver` is an object, this argument is ignored.
 * @returns A promise that resolves with the parsed YAML object of type `R`.
 * @example
 * ```javascript
 * import { readYaml } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const readMyYaml = async () => {
 *   try {
 *     const data = await readYaml(join("path", "to", "my-config.yaml"));
 *     console.log("Config data:", data);
 *
 *     // With a reviver function
 *     const dataWithReviver = await readYaml(join("path", "to", "another.yaml"), (key, value) => {
 *       if (key === "date") return new Date(value);
 *       return value;
 *     });
 *     console.log("Date field is now a Date object:", dataWithReviver.date);
 *
 *     // With options (e.g., for schema validation - assuming yaml options are passed correctly)
 *     // const dataWithOptions = await readYaml(join("path", "to", "options.yaml"), { schema: 'failsafe' });
 *     // console.log(dataWithOptions);
 *
 *   } catch (error) {
 *     console.error("Failed to read or parse YAML file:", error);
 *   }
 * };
 *
 * readMyYaml();
 * ```
 */

async function readYaml<R = Record<string, unknown>>(
    path: URL | string,

    reviver?: ReadYamlOptions<CompressionType> | YamlReviver,
    options?: ReadYamlOptions<CompressionType>,
): Promise<R> {
    const { buffer, compression, encoding = "utf8", flag, ...parseOptions } = options ?? {};

    const content = await readFile(path, { buffer, compression, encoding, flag });

    return (typeof reviver === "function" ? parse(content, reviver, parseOptions) : parse(content, parseOptions)) as R;
}

export default readYaml;
