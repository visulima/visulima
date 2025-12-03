import { ANSI_RESET_CODES, END_CODE, ESCAPES, RE_ESCAPE_PATTERN } from "../constants";
import wrapAnsiCode from "./wrap-ansi-code";
import wrapAnsiHyperlink from "./wrap-ansi-hyperlink";

/**
 * Preserves ANSI escape codes when joining wrapped lines
 * @param rawLines Array of wrapped lines
 * @returns String with preserved ANSI codes
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const preserveAnsi = (rawLines: string[]): string => {
    // Handle empty array case
    if (rawLines.length === 0) {
        return "";
    }

    // Optimize for single line case
    if (rawLines.length === 1) {
        return rawLines[0] as string;
    }

    let returnValue = "";
    let escapeCode: number | string | undefined;
    let escapeUrl: string | undefined;

    const preString = rawLines.join("\n");
    const pre = [...preString];
    let preStringIndex = 0;

    for (const [index, character] of pre.entries()) {
        returnValue += character;

        if (ESCAPES.has(character)) {
            const match = RE_ESCAPE_PATTERN.exec(preString.slice(preStringIndex));
            const groups = match?.groups ?? {};

            if (groups.code !== undefined) {
                const code = Number.parseFloat(groups.code);

                escapeCode = code === END_CODE ? undefined : code;
            } else if (groups.uri !== undefined) {
                escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
            }
        }

        const code = ANSI_RESET_CODES.get(Number(escapeCode));

        if (pre[index + 1] === "\n") {
            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink("");
            }

            if (escapeCode && code) {
                returnValue += wrapAnsiCode(code);
            }
        } else if (character === "\n") {
            if (escapeCode && code) {
                returnValue += wrapAnsiCode(escapeCode);
            }

            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink(escapeUrl);
            }
        }

        preStringIndex += character.length;
    }

    return returnValue;
};

export default preserveAnsi;
