import JSON5 from "json5";

import type { CompressionType, Json5Reviver, ReadJson5Options } from "../types";
import readFileSync from "./read-file-sync";

function readJson5Sync(path: URL | string, options?: ReadJson5Options<CompressionType>): unknown;
function readJson5Sync(path: URL | string, reviver: Json5Reviver, options?: ReadJson5Options<CompressionType>): unknown;

/**
 * Synchronously reads a JSON5 file and parses it into a JavaScript value.
 * @param path The path to the JSON5 file. Can be a file URL or a string path.
 * @param reviver An optional reviver function, or the options object.
 * @param options Optional configuration. See {@link ReadJson5Options}.
 * @returns The parsed value.
 * @example
 * ```javascript
 * import { readJson5Sync } from "@visulima/fs/json5";
 *
 * const config = readJson5Sync("./config.json5");
 * ```
 */

function readJson5Sync(path: URL | string, reviver?: Json5Reviver | ReadJson5Options<CompressionType>, options?: ReadJson5Options<CompressionType>): unknown {
    if (reviver && typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const { beforeParse, buffer, compression, encoding = "utf8", flag } = options ?? {};

    const content = readFileSync(path, { buffer, compression, encoding, flag });
    const input = typeof beforeParse === "function" ? beforeParse(content) : content;

    return JSON5.parse(input, reviver);
}

export default readJson5Sync;
