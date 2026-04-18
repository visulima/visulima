import { toPath } from "@visulima/path/utils";
import type { ParseError } from "jsonc-parser";
import { parse } from "jsonc-parser";

import type { CompressionType, ReadJsoncOptions } from "../types";
import readFileSync from "./read-file-sync";
import { throwIfJsoncErrors } from "./read-jsonc";

/**
 * Synchronously reads a JSONC (JSON with comments) file and parses it into a JavaScript value.
 * Supports `//` and `/* *\/` comments and, optionally, trailing commas via `jsonc-parser`.
 * @param path The path to the JSONC file. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link ReadJsoncOptions}.
 * @returns The parsed value.
 * @example
 * ```javascript
 * import { readJsoncSync } from "@visulima/fs/jsonc";
 *
 * const config = readJsoncSync("./tsconfig.json", { allowTrailingComma: true });
 * ```
 */
const readJsoncSync = (path: URL | string, options?: ReadJsoncOptions<CompressionType>): unknown => {
    const { allowEmptyContent, allowTrailingComma = true, beforeParse, buffer, color, compression, disallowComments, encoding = "utf8", flag } = options ?? {};

    const content = readFileSync(path, { buffer, compression, encoding, flag });
    const input = typeof beforeParse === "function" ? beforeParse(content) : content;

    const errors: ParseError[] = [];
    const result = parse(input, errors, { allowEmptyContent, allowTrailingComma, disallowComments });

    throwIfJsoncErrors(errors, input, toPath(path), { color });

    return result;
};

export default readJsoncSync;
