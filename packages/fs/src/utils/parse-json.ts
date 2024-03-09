import { codeFrame } from "@visulima/error";
import type { JsonValue } from "type-fest";

import JsonError from "../error/json-error";
import type { Reviver } from "../types";
import indexToPosition from "./index-to-position";

const getCodePoint = (character: string): string => `\\u{${character.codePointAt(0).toString(16)}}`;

// eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
const generateCodeFrame = (source: string, location: { column: number; line: number }) => codeFrame(source, { start: location });

const getErrorLocation = (source: string, message: string) => {
    // eslint-disable-next-line security/detect-unsafe-regex
    const match = /in JSON at position (?<index>\d+)(?: \(line (?<line>\d+) column (?<column>\d+)\))?$/.exec(message);

    if (!match) {
        return;
    }

    let { column, index, line } = match.groups;

    if (line && column) {
        return { column: Number(column), line: Number(line) };
    }

    index = Number(index);

    // The error location can be out of bounds.
    if (index === source.length) {
        const { column, line } = indexToPosition(source, source.length - 1, { oneBased: true });

        return { column: column + 1, line };
    }

    return indexToPosition(source, index);
};

const addCodePointToUnexpectedToken = (message) =>
    message.replace(
        // TODO[engine:node@>=20]: The token always quoted after Node.js 20
        /(?<=^Unexpected token )(?<quote>')?(.)\k<quote>/,
        (_, _quote, token) => `"${token}"(${getCodePoint(token)})`,
    );


function parseJson(string: string, filename?: string): JsonValue;
function parseJson(string: string, reviver: Reviver, fileName?: string): JsonValue;
// eslint-disable-next-line func-style
function parseJson(string: string, reviver?: Reviver | string, fileName?: string): JsonValue {
    if (typeof reviver === "string") {
        // eslint-disable-next-line no-param-reassign
        fileName = reviver;
        // eslint-disable-next-line no-param-reassign
        reviver = undefined;
    }

    let message: string;

    try {
        return JSON.parse(string, reviver);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        message = error.message;
    }

    let location: { column: number; line: number } | undefined;
    if (string) {
        location = getErrorLocation(string, message);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message = addCodePointToUnexpectedToken(message);
    } else {
        message += " while parsing empty string";
    }

    const jsonError = new JsonError(message);

    jsonError.fileName = fileName;

    if (location) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        jsonError.codeFrame = generateCodeFrame(string, location);
    }

    throw jsonError;
}

export default parseJson;
