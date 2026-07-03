// eslint-disable-next-line import/no-extraneous-dependencies
import { codeFrame, indexToLineColumn } from "@visulima/error";
import { toPath } from "@visulima/path/utils";
import type { ParseError } from "jsonc-parser";
import { parse, printParseErrorCode } from "jsonc-parser";

import JsonError from "../error/json-error";
import type { CodeFrameOptions, CompressionType, ReadJsoncOptions } from "../types";
import readFile from "./read-file";

const throwIfJsoncErrors = (errors: ParseError[], input: string, filePath: string, codeFrameOptions?: CodeFrameOptions): void => {
    if (errors.length === 0) {
        return;
    }

    const first = errors[0] as ParseError;
    const location = indexToLineColumn(input, first.offset);
    const jsonError = new JsonError(`${printParseErrorCode(first.error)} at offset ${first.offset}`);

    jsonError.fileName = filePath;
    jsonError.codeFrame = codeFrame(input, { start: location }, { tabWidth: false, ...codeFrameOptions });

    throw jsonError;
};

/**
 * Asynchronously reads a JSONC (JSON with comments) file and parses it into a JavaScript value.
 * Supports `//` and `/* *\/` comments and, optionally, trailing commas via `jsonc-parser`.
 * @param path The path to the JSONC file. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link ReadJsoncOptions}.
 * @returns A promise that resolves with the parsed value.
 * @example
 * ```javascript
 * import { readJsonc } from "@visulima/fs/jsonc";
 *
 * const config = await readJsonc("./tsconfig.json", { allowTrailingComma: true });
 * ```
 */
const readJsonc = async (path: URL | string, options?: ReadJsoncOptions<CompressionType>): Promise<unknown> => {
    const { allowEmptyContent, allowTrailingComma = true, beforeParse, buffer, color, compression, disallowComments, encoding = "utf8", flag } = options ?? {};

    const content = await readFile(path, { buffer, compression, encoding, flag });
    const input = typeof beforeParse === "function" ? beforeParse(content) : content;

    const errors: ParseError[] = [];
    const result = parse(input, errors, { allowEmptyContent, allowTrailingComma, disallowComments });

    throwIfJsoncErrors(errors, input, toPath(path), { color });

    return result;
};

export { throwIfJsoncErrors };
export default readJsonc;
