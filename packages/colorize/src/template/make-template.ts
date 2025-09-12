/**
 * Modified copy of https://github.com/chalk/chalk-template/blob/main/index.js
 *
 * MIT License
 *
 * Copyright (c) Josh Junon
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

import type { ColorizeType, ColorValueHex } from "../types";
import { convertHexToRgb } from "../util/convert-hex-to-rgb";
import { unescape } from "../util/unescape";

const TEMPLATE_REGEX
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-lazy-ends,regexp/no-dupe-disjunctions
    = /\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.)|\{(~)?(#?[\w:]+(?:\([^)]*\))?(?:\.#?[\w:]+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n))|(\})|((?:.|[\r\n\f])+?)/gi;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/optimal-lookaround-quantifier
const STYLE_REGEX = /(?:^|\.)(?:(\w+)(?:\(([^)]*)\))?|#(?=[:a-f\d]{2,})([a-f\d]{6})?(?::([a-f\d]{6}))?)/gi;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.)|([^\\])/gi;

const parseArguments = (name: string, value: string): (number | string)[] => {
    const results: (number | string)[] = [];
    const chunks = value.trim().split(/\s*,\s*/);

    let matches;

    // eslint-disable-next-line no-loops/no-loops
    for (const chunk of chunks) {
        const number = Number(chunk);

        if (!Number.isNaN(number)) {
            results.push(number);
            // eslint-disable-next-line no-cond-assign
        } else if (matches = STRING_REGEX.exec(chunk)) {
            // eslint-disable-next-line unicorn/prefer-string-replace-all
            results.push((matches[2] as string).replace(ESCAPE_REGEX, (_, escape, character) => (escape ? unescape(escape as string) : character)));
        } else {
            throw new Error(`Invalid template style argument: ${chunk} (in style '${name}')`);
        }
    }

    return results;
};

const parseStyle: (style: string) => (number | string | undefined)[][] = (style: string) => {
    STYLE_REGEX.lastIndex = 0;

    const results: (number | string | undefined)[][] = [];
    let matches;

    // eslint-disable-next-line no-loops/no-loops,no-cond-assign
    while ((matches = STYLE_REGEX.exec(style)) !== null) {
        const name = matches[1];

        if (matches[2]) {
            results.push([name, ...parseArguments(name as string, matches[2])]);
        } else if (matches[3] || matches[4]) {
            if (matches[3]) {
                results.push(["rgb", ...convertHexToRgb(matches[3] as ColorValueHex)]);
            }

            if (matches[4]) {
                results.push(["bgRgb", ...convertHexToRgb(matches[4] as ColorValueHex)]);
            }
        } else {
            results.push([name]);
        }
    }

    return results;
};

const buildStyle = (
    colorize: ColorizeType,
    styles: {
        inverse: string | undefined;
        styles: (number | string | undefined)[][];
    }[],
) => {
    const enabled: Record<string, (number | string | undefined)[] | null> = {};

    // eslint-disable-next-line no-loops/no-loops
    for (const layer of styles) {
        // eslint-disable-next-line no-loops/no-loops
        for (const style of layer.styles) {
            enabled[style[0] as string] = layer.inverse ? null : style.slice(1);
        }
    }

    let current: ColorizeType = colorize;

    // eslint-disable-next-line no-loops/no-loops
    for (const [styleName, enabledStyles] of Object.entries(enabled)) {
        if (!Array.isArray(enabledStyles)) {
            continue;
        }

        if (!(styleName in current)) {
            throw new Error(`Unknown style: ${styleName}`);
        }

        // @ts-expect-error - @TODO fix types

        current = enabledStyles.length > 0 ? current[styleName as keyof ColorizeType](...enabledStyles) : current[styleName as keyof ColorizeType];
    }

    return current;
};

export const makeTemplate
    = (colorize: ColorizeType): (string: string) => string =>
        (string: string) => {
            const styles: {
                inverse: string | undefined;
                styles: (number | string | undefined)[][];
            }[] = [];
            const chunks = [];

            let chunk: string[] = [];

            string.replaceAll(
                TEMPLATE_REGEX,
                // @ts-expect-error - TS doesn't understand that the regex args are defined
                (
                    _: string,
                    escapeCharacter: string | undefined,
                    inverse: string | undefined,
                    style: string | undefined,
                    close: string | undefined,
                    character: string | undefined,
                ) => {
                    if (escapeCharacter) {
                        chunk.push(unescape(escapeCharacter) as string);
                    } else if (style) {
                        const joinedChunk = chunk.join("");

                        chunk = [];
                        chunks.push(styles.length === 0 ? joinedChunk : buildStyle(colorize, styles)(joinedChunk));

                        styles.push({ inverse, styles: parseStyle(style) });
                    } else if (close) {
                        if (styles.length === 0) {
                            throw new Error("Found extraneous } in template literal");
                        }

                        chunks.push(buildStyle(colorize, styles)(chunk.join("")));
                        chunk = [];

                        styles.pop();
                    } else {
                        chunk.push(character as string);
                    }
                },
            );

            chunks.push(chunk.join(""));

            if (styles.length > 0) {
                throw new Error(`template literal is missing ${styles.length} closing bracket${styles.length === 1 ? "" : "s"} (\`}\`)`);
            }

            return chunks.join("");
        };
