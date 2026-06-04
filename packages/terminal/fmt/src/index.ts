import type { CssObject } from "./inspect-colors";
import { cssToAnsi, parseCss } from "./inspect-colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tryStringify = (o: any): string => {
    try {
        return JSON.stringify(o);
    } catch {
        return "\"[Circular]\"";
    }
};

const CHAR_PERCENT = "%".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_s = "s".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_d = "d".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_f = "f".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_i = "i".codePointAt(0);
const CHAR_O = "O".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_o = "o".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_j = "j".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_c = "c".codePointAt(0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any,sonarjs/cognitive-complexity
export const format = (fmt: Record<string, any> | string, arguments_: any[] = [], options: Options = {}): string => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
    if ((typeof fmt !== "string" && typeof fmt !== "object") || fmt === null) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        throw new TypeError(`fmt must be a string or object, got ${fmt === null ? "null" : typeof fmt}`);
    }

    const stringify = options.stringify ?? tryStringify;
    const offset = 1;

    if (typeof fmt === "object") {
        const argumentsLength = arguments_.length + offset;

        if (argumentsLength === 1) {
            return "{}";
        }

        const objects = Array.from({ length: argumentsLength });

        objects[0] = stringify(fmt);

        for (let index = 1; index < argumentsLength; index += 1) {
            objects[index] = stringify(arguments_[index - offset]);
        }

        return objects.join(" ");
    }

    if (arguments_.length === 0) {
        return fmt;
    }

    let result = "";
    let a = 1 - offset;
    let lastPosition = -1;

    let usedStyle = false;
    let previousCss: CssObject | undefined;

    for (let index = 0; index < fmt.length;) {
        if (fmt.codePointAt(index) === CHAR_PERCENT && index + 1 < fmt.length) {
            lastPosition = lastPosition > -1 ? lastPosition : 0;

            const c = fmt.codePointAt(index + 1);

            if (c === undefined) {
                a += 1; // eslint-disable-line no-useless-assignment,sonarjs/no-dead-store
                break;
            }

            switch (c) {
                case CHAR_c: {
                    // Inspired by Deno's handling of '%c'.
                    // eslint-disable-next-line no-secrets/no-secrets
                    // https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L3115
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
                    if (globalThis.window === undefined) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        const css = parseCss(arguments_[a as keyof typeof arguments_]);

                        if (lastPosition < index) {
                            result += fmt.slice(lastPosition, index);
                        }

                        const ansi = cssToAnsi(css, previousCss);

                        result += ansi;

                        if (ansi !== "") {
                            usedStyle = true;
                            previousCss = css;
                        }
                    }

                    lastPosition = index + 2;

                    index += 1;

                    break;
                }
                case CHAR_d:
                case CHAR_f: {
                    // eslint-disable-next-line eqeqeq
                    if (a >= arguments_.length || arguments_[a as keyof typeof arguments_] == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    const dValue = arguments_[a as keyof typeof arguments_];

                    result += (typeof dValue === "symbol" ? Number.NaN : Number(dValue)).toString();
                    lastPosition = index + 2;

                    index += 1;
                    break;
                }
                case CHAR_i: {
                    // eslint-disable-next-line eqeqeq
                    if (a >= arguments_.length || arguments_[a as keyof typeof arguments_] == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    const iValue = arguments_[a as keyof typeof arguments_];

                    result += Math.floor(typeof iValue === "symbol" ? Number.NaN : Number(iValue)).toString();
                    lastPosition = index + 2;

                    index += 1;
                    break;
                }
                case CHAR_j:
                case CHAR_O:
                case CHAR_o: {
                    if (a >= arguments_.length || arguments_[a as keyof typeof arguments_] === undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const temporaryArgument = arguments_[a as keyof typeof arguments_];
                    const type = typeof temporaryArgument;

                    if (type === "string") {
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        result += `'${temporaryArgument}'`;
                        lastPosition = index + 2;

                        index += 1;
                        break;
                    }

                    if (type === "function") {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                        result += (temporaryArgument as Function).name ? `[Function: ${(temporaryArgument as Function).name}]` : "[Function: <anonymous>]";
                        lastPosition = index + 2;

                        index += 1;
                        break;
                    }

                    result += stringify(temporaryArgument);
                    lastPosition = index + 2;

                    index += 1;
                    break;
                }
                case CHAR_PERCENT: {
                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result += "%";
                    lastPosition = index + 2;

                    index += 1;
                    a -= 1;
                    break;
                }
                case CHAR_s: {
                    if (a >= arguments_.length) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result
                        += typeof arguments_[a as keyof typeof arguments_] === "object"
                            ? stringify(arguments_[a as keyof typeof arguments_])
                            : String(arguments_[a as keyof typeof arguments_]);
                    lastPosition = index + 2;

                    index += 1;
                    break;
                }
                default: {
                    if (typeof options.formatters?.[c] === "function") {
                        if (lastPosition < index) {
                            result += fmt.slice(lastPosition, index);
                        }

                        result += options.formatters[c](arguments_[a as keyof typeof arguments_]);

                        lastPosition = index + 2;

                        index += 1;
                    }
                }
            }

            a += 1;
        }

        index += 1;
    }

    if (lastPosition === -1) {
        return fmt;
    }

    if (lastPosition < fmt.length) {
        result += fmt.slice(lastPosition);
    }

    if (usedStyle) {
        result += "\u001B[0m";
    }

    return result;
};

export const build = (
    options: Options = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (f: NonNullable<Record<string, any> | string>, arguments_?: any[], formatOptions?: Omit<Options, "formatters">) => string => {
    const formatters: FormatterMap = {};

    if (typeof options.formatters === "object") {
        Object.entries(options.formatters).forEach(([key, formatterFunction]) => {
            if (key.length === 0) {
                throw new Error(`Formatter %${key} has no characters`);
            }

            if (key.length > 1) {
                throw new Error(`Formatter %${key} has more than one character`);
            }

            if (typeof formatterFunction !== "function") {
                throw new TypeError(`Formatter for %${key} is not a function`);
            }

            const c = key.codePointAt(0);

            if (c === undefined) {
                throw new Error(`${key}.codePointAt(0) failed to return a value, please report this issue`);
            }

            formatters[c] = formatterFunction;
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (f: NonNullable<Record<string, any> | string>, arguments_: any[] = [], formatOptions: Omit<Options, "formatters"> = {}) =>
        format(f, arguments_, { ...formatOptions, formatters });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormatterFunction = (argument: any) => string;
export type FormatterMap = Record<number, FormatterFunction>;

export interface Options {
    formatters?: Record<string, FormatterFunction>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stringify?: (o: any) => string;
}
