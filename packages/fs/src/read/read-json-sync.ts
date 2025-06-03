import { toPath } from "@visulima/path/utils";
import type { JsonValue } from "type-fest";

import type { JsonReviver, ReadJsonOptions } from "../types";
import parseJson from "../utils/parse-json";
import readFileSync from "./read-file-sync";

function readJsonSync<T extends JsonValue>(path: URL | string, options?: ReadJsonOptions): T;

function readJsonSync<T extends JsonValue>(path: URL | string, reviver: JsonReviver, options?: ReadJsonOptions): T;

/**
 * Synchronously reads a JSON file and then parses it into an object.
 *
 * @template T The expected type of the parsed JSON object.
 * @param path The path to the JSON file to read. Can be a file URL or a string path.
 * @param reviver A function to transform the results. This function is called for each member of the object.
 *                Alternatively, this can be the `options` object if no reviver function is provided.
 * @param options Optional configuration for reading and parsing the JSON file. See {@link ReadJsonOptions}.
 *                If `reviver` is an object, this argument is ignored.
 * @returns The parsed JSON object of type `T`.
 * @example
 * ```javascript
 * import { readJsonSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * try {
 *   const data = readJsonSync(join("path", "to", "my-config.json"));
 *   console.log("Config data:", data);
 *
 *   // With a reviver function
 *   const dataWithReviver = readJsonSync(join("path", "to", "another.json"), (key, value) => {
 *     if (key === "date") return new Date(value);
 *     return value;
 *   });
 *   console.log("Date field is now a Date object:", dataWithReviver.date);
 *
 *   // With options (e.g., for custom error reporting)
 *   const dataWithOptions = readJsonSync(join("path", "to", "options.json"), { color: { message: (str) => `\x1b[31m${str}\x1b[0m` } });
 *   console.log(dataWithOptions);
 *
 * } catch (error) {
 *   console.error("Failed to read or parse JSON file:", error);
 * }
 * ```
 */
// eslint-disable-next-line func-style
function readJsonSync<T extends JsonValue>(path: URL | string, reviver: JsonReviver | ReadJsonOptions, options?: ReadJsonOptions): T {
    if (typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const content = readFileSync(path, {
        buffer: true,
        encoding: undefined,
    });

    // Unlike `buffer.toString()` and `fs.readFile(path, 'utf8')`, `TextDecoder` will remove BOM.
    let data = new TextDecoder().decode(content);

    const { beforeParse, color } = options ?? {};

    if (typeof beforeParse === "function") {
        data = beforeParse(data);
    }

    return parseJson<T>(data, reviver as JsonReviver, toPath(path), { color });
}

export default readJsonSync;
