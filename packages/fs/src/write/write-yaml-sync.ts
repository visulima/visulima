import { stringify, type ToStringOptions } from "yaml";

import type { WriteYamlOptions, YamlReplacer } from "../types";
import writeFileSync from "./write-file-sync";

function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options?: WriteYamlOptions,
): void;
function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    replacer?: YamlReplacer,
    options?: WriteYamlOptions | number | string,
): void;
/**
 * Synchronously writes an object to a YAML file.
 *
 * @param path The path to the YAML file to write. Can be a file URL or a string path.
 * @param data The data to serialize and write. Can be any JavaScript value that can be stringified by `yaml.stringify`.
 * @param replacer Optional. A replacer function or an array of keys to include, or the options object itself.
 *                 See `yaml.stringify` documentation for more details.
 * @param options Optional. Configuration for writing and stringifying the YAML file. See {@link WriteYamlOptions}.
 *                If `replacer` is an object and not a function/array, it's treated as `options`.
 *                The `space` property within options can be a number for spaces or a string for tabs/etc.
 * @returns void
 * @example
 * ```javascript
 * import { writeYamlSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyYamlSync = () => {
 *   try {
 *     writeYamlSync(join("/tmp", "my-data-sync.yaml"), { name: "Jane Doe", age: 28, city: "London" });
 *     console.log("YAML file written successfully (sync).");
 *
 *     writeYamlSync(join("/tmp", "another-data-sync.yaml"), { user: "john_sync", details: { id: 2, status: "inactive" } }, null, 4);
 *     console.log("Another YAML file written with 4 spaces indentation (sync).");
 *
 *     const customReplacer = (key, value) => (key === "city" ? "REDACTED" : value);
 *     writeYamlSync(join("/tmp", "filtered-data-sync.yaml"), { name: "Peter", age: 50, city: "Paris" }, customReplacer, { space: 2 });
 *     console.log("Filtered YAML file written with 2 spaces indentation (sync).");
 *   } catch (error) {
 *     console.error("Failed to write YAML file (sync):", error);
 *   }
 * };
 *
 * writeMyYamlSync();
 * ```
 */
// eslint-disable-next-line func-style
function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    data: any,
    replacer?: WriteYamlOptions | YamlReplacer,
    options?: WriteYamlOptions | number | string,
): void {
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

    writeFileSync(path, content, stringifyOptions);
}

export default writeYamlSync;
