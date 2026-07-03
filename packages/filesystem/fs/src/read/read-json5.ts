import JSON5 from "json5";

import type { CompressionType, Json5Reviver, ReadJson5Options } from "../types";
import readFile from "./read-file";

async function readJson5<R = unknown>(path: URL | string, options?: ReadJson5Options<CompressionType>): Promise<R>;
async function readJson5<R = unknown>(path: URL | string, reviver: Json5Reviver, options?: ReadJson5Options<CompressionType>): Promise<R>;

/**
 * Asynchronously reads a JSON5 file and parses it into a JavaScript value.
 * @template R The expected type of the parsed value.
 * @param path The path to the JSON5 file. Can be a file URL or a string path.
 * @param reviver An optional reviver function, or the options object.
 * @param options Optional configuration. See {@link ReadJson5Options}.
 * @returns A promise that resolves with the parsed value.
 * @example
 * ```javascript
 * import { readJson5 } from "@visulima/fs/json5";
 *
 * const config = await readJson5("./config.json5");
 * ```
 */

async function readJson5<R = unknown>(
    path: URL | string,
    reviver?: Json5Reviver | ReadJson5Options<CompressionType>,
    options?: ReadJson5Options<CompressionType>,
): Promise<R> {
    if (reviver && typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const { beforeParse, buffer, compression, encoding = "utf8", flag } = options ?? {};

    const content = await readFile(path, { buffer, compression, encoding, flag });
    const input = typeof beforeParse === "function" ? beforeParse(content) : content;

    return JSON5.parse(input, reviver);
}

export default readJson5;
