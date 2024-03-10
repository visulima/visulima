import type { JsonValue } from "type-fest";

import { R_OK } from "./constants";
import isAccessible from "./is-accessible";
import readFile from "./read-file";
import type { JsonReviver, ReadJsonOptions } from "./types";
import parseJson from "./utils/parse-json";

async function readJson<T extends JsonValue>(path: string, options?: ReadJsonOptions): Promise<T>;

async function readJson<T extends JsonValue>(path: string, reviver: JsonReviver, options?: ReadJsonOptions): Promise<T>;
// eslint-disable-next-line func-style
async function readJson<T extends JsonValue>(path: string, reviver: JsonReviver | ReadJsonOptions, options?: ReadJsonOptions): Promise<T> {
    if (!(await isAccessible(path, R_OK))) {
        throw new Error(`Invalid access to read JSON file at: ${path}`);
    }

    if (typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const { beforeParse, color } = options ?? {};

    const content = await readFile(path, {
        buffer: true,
        encoding: undefined,
    });

    // Unlike `buffer.toString()` and `fs.readFile(path, 'utf8')`, `TextDecoder` will remove BOM.
    let data = new TextDecoder().decode(content);

    if (typeof beforeParse === "function") {
        data = beforeParse(data);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return parseJson<T>(data, reviver, path, { color });
}

export default readJson;
