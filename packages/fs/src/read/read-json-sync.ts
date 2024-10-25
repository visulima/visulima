import { toPath } from "@visulima/path/utils";
import type { JsonValue } from "type-fest";

import type { JsonReviver, ReadJsonOptions } from "../types";
import parseJson from "../utils/parse-json";
import readFileSync from "./read-file-sync";

function readJsonSync<T extends JsonValue>(path: URL | string, options?: ReadJsonOptions): T;

function readJsonSync<T extends JsonValue>(path: URL | string, reviver: JsonReviver, options?: ReadJsonOptions): T;
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
