import type { JsonValue } from "type-fest";

import { R_OK } from "./constants";
import isAccessibleSync from "./is-accessible-sync";
import readFileSync from "./read-file-sync";
import type { JsonReviver, ReadJsonOptions } from "./types";
import parseJson from "./utils/parse-json";

function readJsonSync<T extends JsonValue>(path: string, options?: ReadJsonOptions): T;

function readJsonSync<T extends JsonValue>(path: string, reviver: JsonReviver, options?: ReadJsonOptions): T;
// eslint-disable-next-line func-style
function readJsonSync<T extends JsonValue>(path: string, reviver: JsonReviver | ReadJsonOptions, options?: ReadJsonOptions): T {
    if (!isAccessibleSync(path, R_OK)) {
        throw new Error(`Invalid access to read JSON file at: ${path}`);
    }

    if (typeof reviver === "object") {
        // eslint-disable-next-line no-param-reassign
        options = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    const { beforeParse, color } = options ?? {};

    const content = readFileSync(path, {
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

export default readJsonSync;
