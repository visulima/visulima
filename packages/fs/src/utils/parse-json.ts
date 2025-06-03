/**
 * A modified version of `parse-json` from `https://github.com/sindresorhus/parse-json/blob/main/index.js`
 *
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { codeFrame, indexToLineColumn } from "@visulima/error";
import type { JsonValue } from "type-fest";

import JsonError from "../error/json-error";
import type { CodeFrameLocation, CodeFrameOptions, JsonReviver } from "../types";

const getCodePoint = (character: string): string => `\\u{${(character.codePointAt(0) as number).toString(16)}}`;

const generateCodeFrame = (source: string, location: CodeFrameLocation, options?: CodeFrameOptions) =>
    codeFrame(
        source,
        { start: location },
        {
            tabWidth: false,
            ...options,
        },
    );

const getErrorLocation = (source: string, message: string): CodeFrameLocation | undefined => {
    // eslint-disable-next-line security/detect-unsafe-regex
    const match = /in JSON at position (?<index>\d+)(?: \(line (?<line>\d+) column (?<column>\d+)\))?$/.exec(message);

    if (!match) {
        return undefined;
    }

    // eslint-disable-next-line prefer-const
    let { column, index, line } = match.groups as { column?: string; index: number | string; line?: string };

    if (line && column) {
        return { column: Number(column), line: Number(line) };
    }

    index = Number(index);

    // The error location can be out of bounds.
    if (index === source.length) {
        index = source.length - 1;
    }

    return indexToLineColumn(source, index);
};

const addCodePointToUnexpectedToken = (message: string): string =>
    message.replace(
        // TODO[engine:node@>=20]: The token always quoted after Node.js 20
        // eslint-disable-next-line regexp/no-potentially-useless-backreference
        /(?<=^Unexpected token )(?<quote>')?(.)\k<quote>/,

        (_, _quote, token: string) => `"${token}"(${getCodePoint(token)})`,
    );

function parseJson<T = JsonValue>(string: string, filename?: string, options?: CodeFrameOptions): T;
function parseJson<T = JsonValue>(string: string, reviver: JsonReviver, fileName?: string, options?: CodeFrameOptions): T;
/**
 * Parses a JSON string, constructing the JavaScript value or object described by the string.
 * This is a modified version of `parse-json` from `https://github.com/sindresorhus/parse-json/blob/main/index.js`.
 * It provides more detailed error messages including code frames.
 *
 * @template T The type of the parsed JSON value.
 * @param string The JSON string to parse.
 * @param [reviver] An optional reviver function that can transform the results, or a filename string if no reviver is used.
 * @param [fileName] An optional filename string (if reviver is provided), or CodeFrameOptions (if reviver is not provided and this is the third argument).
 * @param [options] Optional options for generating the code frame on error.
 * @returns {T} The JavaScript value or object described by the JSON string.
 * @throws {JsonError} If the string to parse is not valid JSON, or if any other parsing error occurs.
 * @example
 * ```javascript
 * import { parseJson } from "@visulima/fs"; // Assuming this util is exported or re-exported
 *
 * const jsonString = '{"name": "John Doe", "age": 30, "city": "New York"}';
 * const malformedJson = '{"name": "Jane Doe", "age": "thirty}'; // Missing quote
 *
 * try {
 *   const data = parseJson(jsonString);
 *   console.log(data.name); // Output: John Doe
 *
 *   const dataWithReviver = parseJson(jsonString, (key, value) => {
 *     if (key === "age") {
 *       return value + 5;
 *     }
 *     return value;
 *   });
 *   console.log(dataWithReviver.age); // Output: 35
 *
 *   // With filename for better error reporting
 *   const user = parseJson(malformedJson, "user-data.json");
 *
 * } catch (error) {
 *   // error will be an instance of JsonError
 *   console.error(error.message);
 *   // Example error message:
 *   // Unexpected token } in JSON at position 37 in user-data.json
 *   //
 *   //   35 |   "name": "Jane Doe",
 *   // > 36 |   "age": "thirty}
 *   //      |                 ^
 *   //   37 |
 *   if (error.fileName) {
 *     console.error(`Error in file: ${error.fileName}`);
 *   }
 *   if (error.codeFrame) {
 *     console.error(error.codeFrame);
 *   }
 * }
 * ```
 */
// eslint-disable-next-line func-style
function parseJson<T = JsonValue>(string: string, reviver?: JsonReviver | string, fileName?: CodeFrameOptions | string, options?: CodeFrameOptions): T {
    if (typeof reviver === "string") {
        if (typeof fileName === "object") {
            // eslint-disable-next-line no-param-reassign
            options = fileName;
        }

        // eslint-disable-next-line no-param-reassign
        fileName = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    let message: string;

    try {
        return JSON.parse(string, reviver as JsonReviver);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        message = error.message;
    }

    let location: CodeFrameLocation | undefined;

    if (string) {
        location = getErrorLocation(string, message);
        message = addCodePointToUnexpectedToken(message);
    } else {
        message += " while parsing empty string";
    }

    const jsonError = new JsonError(message);

    jsonError.fileName = fileName as string;

    if (location) {
        jsonError.codeFrame = generateCodeFrame(string, location, options);
    }

    throw jsonError;
}

export default parseJson;
