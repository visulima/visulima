import { stringify } from "yaml";

import type { WriteYamlOptions, YamlReplacer } from "../types";
import writeFile from "./write-file";

async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options?: WriteYamlOptions,
): Promise<void>;
async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    replacer?: YamlReplacer,
    options?: WriteYamlOptions | number | string,
): Promise<void>;
/**
 * Asynchronously writes an object to a YAML file.
 *
 * @param path The path to the YAML file to write. Can be a file URL or a string path.
 * @param data The data to serialize and write. Can be any JavaScript value that can be stringified by `yaml.stringify`.
 * @param replacer Optional. A replacer function or an array of keys to include, or the options object itself.
 *                 See `yaml.stringify` documentation for more details.
 * @param options Optional. Configuration for writing and stringifying the YAML file. See {@link WriteYamlOptions}.
 *                If `replacer` is an object and not a function/array, it's treated as `options`.
 *                The `space` property within options can be a number for spaces or a string for tabs/etc.
 * @returns A promise that resolves when the YAML file has been written.
 * @example
 * ```javascript
 * import { writeYaml } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyYaml = async () => {
 *   try {
 *     await writeYaml(join("/tmp", "my-data.yaml"), { name: "John Doe", age: 30, city: "New York" });
 *     console.log("YAML file written successfully.");
 *
 *     await writeYaml(join("/tmp", "another-data.yaml"), { user: "jane", details: { id: 1, status: "active" } }, null, 2);
 *     console.log("Another YAML file written with 2 spaces indentation.");
 *
 *     const customReplacer = (key, value) => (key === "age" ? undefined : value);
 *     await writeYaml(join("/tmp", "filtered-data.yaml"), { name: "Smith", age: 45, occupation: "Engineer" }, customReplacer, { space: '\t' });
 *     console.log("Filtered YAML file written with tab indentation.");
 *   } catch (error) {
 *     console.error("Failed to write YAML file:", error);
 *   }
 * };
 *
 * writeMyYaml();
 * ```
 */
// eslint-disable-next-line func-style
async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    data: any,
    replacer?: WriteYamlOptions | YamlReplacer,
    options?: WriteYamlOptions | number | string,
): Promise<void> {
    let stringifyOptions: WriteYamlOptions | undefined;
    let effectiveReplacer: YamlReplacer | undefined;
    let space: number | string | undefined;

    if (typeof replacer === 'object' && replacer !== null && !Array.isArray(replacer) && typeof replacer !== 'function') {
        stringifyOptions = replacer as WriteYamlOptions;
        effectiveReplacer = stringifyOptions.replacer;
        space = stringifyOptions.space;
    } else if (typeof options === 'object' && options !== null) {
        stringifyOptions = options as WriteYamlOptions;
        effectiveReplacer = replacer as YamlReplacer;
        space = stringifyOptions.space ?? (typeof options === 'number' || typeof options === 'string' ? options : undefined);
    } else {
        effectiveReplacer = replacer as YamlReplacer;
        space = options as number | string | undefined;
    }

    const content = stringify(data, effectiveReplacer, space ?? (stringifyOptions as ToStringOptions));

    await writeFile(path, content, stringifyOptions);
}

export default writeYaml;
