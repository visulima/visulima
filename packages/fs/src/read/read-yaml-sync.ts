import { parse } from "yaml";

import readFileSync from "./read-file-sync";
import type { ReadYamlOptions, YamlReviver } from "../types";

function readYamlSync<R = Record<string, unknown>>(path: URL | string, options?: ReadYamlOptions<"brotli" | "gzip" | "none">): R;
function readYamlSync<R = Record<string, unknown>>(path: URL | string, reviver?: YamlReviver, options?: ReadYamlOptions<"brotli" | "gzip" | "none">): R;
// eslint-disable-next-line func-style
function readYamlSync<R = Record<string, unknown>>(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    reviver?: ReadYamlOptions<"brotli" | "gzip" | "none"> | YamlReviver,
    options?: ReadYamlOptions<"brotli" | "gzip" | "none">,
): R {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {
        buffer,
        compression,
        encoding = "utf8",
        flag,
        ...parseOptions
    } = options ?? {};

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const content = readFileSync(path, { buffer, compression, encoding, flag });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (typeof reviver === "function" ? parse(content, reviver, parseOptions) : parse(content, parseOptions)) as R;
}

export default readYamlSync;
