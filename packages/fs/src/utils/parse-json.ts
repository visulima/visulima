/**
 * A modified version of `parse-json` from `https://github.com/sindresorhus/parse-json/blob/main/index.js`
 *
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { codeFrame } from "@visulima/error";
import type { JsonValue } from "type-fest";

import JsonError from "../error/json-error";
import type { CodeFrameLocation, CodeFrameOptions, JsonReviver } from "../types";
import indexToPosition from "./index-to-position";

const getCodePoint = (character: string): string => `\\u{${(character.codePointAt(0) as number).toString(16)}}`;

const generateCodeFrame = (source: string, location: CodeFrameLocation, options?: CodeFrameOptions) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
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

        const { column: pColumn, line: pLine } = indexToPosition(source, source.length - 1);

        return { column: pColumn + 1, line: pLine + 1 };
    }

    return indexToPosition(source, index);
};

const addCodePointToUnexpectedToken = (message: string): string =>
    message.replace(
        // TODO[engine:node@>=20]: The token always quoted after Node.js 20
        // eslint-disable-next-line regexp/no-potentially-useless-backreference
        /(?<=^Unexpected token )(?<quote>')?(.)\k<quote>/,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        (_, _quote, token) => `"${token}"(${getCodePoint(token)})`,
    );

function parseJson<T = JsonValue>(string: string, filename?: string, options?: CodeFrameOptions): T;
function parseJson<T = JsonValue>(string: string, reviver: JsonReviver, fileName?: string, options?: CodeFrameOptions): T;
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(string, reviver);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        jsonError.codeFrame = generateCodeFrame(string, location, options);
    }

    throw jsonError;
}

export default parseJson;
