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
// eslint-disable-next-line @typescript-eslint/naming-convention,unicorn/prevent-abbreviations
const CHAR_i = "i".codePointAt(0);
const CHAR_O = "O".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_o = "o".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention,unicorn/prevent-abbreviations
const CHAR_j = "j".codePointAt(0);
// eslint-disable-next-line @typescript-eslint/naming-convention
const CHAR_c = "c".codePointAt(0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any,sonarjs/cognitive-complexity
export const format = (fmt: Record<string, any> | string, arguments_: any[] = [], options: Options = {}): string => {
    if ((typeof fmt !== "string" && typeof fmt !== "object") || fmt === null) {
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

        for (let index = 1; index < argumentsLength; index++) {
            // eslint-disable-next-line security/detect-object-injection
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
    let previousCss = null;

    for (let index = 0; index < fmt.length;) {
        if (fmt.codePointAt(index) === CHAR_PERCENT && index + 1 < fmt.length) {
            lastPosition = lastPosition > -1 ? lastPosition : 0;

            const c = fmt.codePointAt(index + 1);

            if (c === undefined) {
                ++a;
                break;
            }

            switch (c) {
                case CHAR_c: {
                    // Inspired by Deno's handling of '%c'.
                    // eslint-disable-next-line no-secrets/no-secrets
                    // https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L3115
                    if (globalThis.window === undefined) {
                        const css = parseCss(arguments_[a as keyof typeof arguments_]);

                        if (lastPosition < index) {
                            result += fmt.slice(lastPosition, index);
                        }

                        result += cssToAnsi(css, previousCss);

                        if (result !== "") {
                            usedStyle = true;
                            previousCss = css;
                        }
                    }

                    lastPosition = index + 2;

                    index++;

                    break;
                }
                case CHAR_d:
                case CHAR_f: {
                    if (a >= arguments_.length || arguments_[a as keyof typeof arguments_] == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result += Number(arguments_[a as keyof typeof arguments_]).toString();
                    lastPosition = index + 2;

                    index++;
                    break;
                }
                case CHAR_i: {
                    if (a >= arguments_.length || arguments_[a as keyof typeof arguments_] == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result += Math.floor(Number(arguments_[a as keyof typeof arguments_])).toString();
                    lastPosition = index + 2;

                    index++;
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

                    const temporaryArgument = arguments_[a as keyof typeof arguments_];
                    const type = typeof temporaryArgument;

                    if (type === "string") {
                        result += `'${temporaryArgument}'`;
                        lastPosition = index + 2;
                        break;
                    }

                    if (type === "function") {
                        // eslint-disable-next-line @typescript-eslint/ban-types
                        result += (temporaryArgument as Function).name ? `[Function: ${(temporaryArgument as Function).name}]` : "[Function: <anonymous>]";
                        lastPosition = index + 2;
                        break;
                    }

                    result += stringify(temporaryArgument);
                    lastPosition = index + 2;

                    index++;
                    break;
                }
                case CHAR_PERCENT: {
                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result += "%";
                    lastPosition = index + 2;

                    index++;
                    a--;
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

                    index++;
                    break;
                }
                default: {
                    // eslint-disable-next-line security/detect-object-injection
                    if (typeof options.formatters?.[c] === "function") {
                        if (lastPosition < index) {
                            result += fmt.slice(lastPosition, index);
                        }

                        // eslint-disable-next-line security/detect-object-injection
                        result += (options.formatters[c] as FormatterFunction)(arguments_[a as keyof typeof arguments_]);

                        lastPosition = index + 2;

                        index++;
                    }
                }
            }

            ++a;
        }

        ++index;
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

            // eslint-disable-next-line security/detect-object-injection
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
