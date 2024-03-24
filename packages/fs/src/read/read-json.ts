import type { JsonValue } from "type-fest";

import type { JsonReviver, ReadJsonOptions } from "../types";
import parseJson from "../utils/parse-json";
import toPath from "../utils/to-path";
import readFile from "./read-file";

async function readJson<T extends JsonValue>(path: URL | string, options?: ReadJsonOptions): Promise<T>;

async function readJson<T extends JsonValue>(path: URL | string, reviver: JsonReviver, options?: ReadJsonOptions): Promise<T>;
// eslint-disable-next-line func-style
async function readJson<T extends JsonValue>(path: URL | string, reviver: JsonReviver | ReadJsonOptions, options?: ReadJsonOptions): Promise<T> {
    if (typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const content = await readFile(path, {
        buffer: true,
        encoding: undefined,
    });

    // Unlike `buffer.toString()` and `fs.readFile(path, 'utf8')`, `TextDecoder` will remove BOM.
    let data = new TextDecoder().decode(content);

    const { beforeParse, color } = options ?? {};

    if (typeof beforeParse === "function") {
        data = beforeParse(data);
    }

    return parseJson<T>(data, reviver, toPath(path), { color });
}

export default readJson;
