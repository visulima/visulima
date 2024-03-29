import { parse } from "yaml";

import type { ReadYamlOptions, YamlReviver } from "../types";
import readFile from "./read-file";

async function readYaml<R = Record<string, unknown>>(path: URL | string, options?: ReadYamlOptions<"brotli" | "gzip" | "none">): Promise<R>;
async function readYaml<R = Record<string, unknown>>(
    path: URL | string,
    reviver?: YamlReviver,
    options?: ReadYamlOptions<"brotli" | "gzip" | "none">,
): Promise<R>;

// eslint-disable-next-line func-style
async function readYaml<R = Record<string, unknown>>(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    reviver?: ReadYamlOptions<"brotli" | "gzip" | "none"> | YamlReviver,
    options?: ReadYamlOptions<"brotli" | "gzip" | "none">,
): Promise<R> {
    const { buffer, compression, encoding = "utf8", flag, ...parseOptions } = options ?? {};

    const content = await readFile(path, { buffer, compression, encoding, flag });

    return (typeof reviver === "function" ? parse(content, reviver, parseOptions) : parse(content, parseOptions)) as R;
}

export default readYaml;
