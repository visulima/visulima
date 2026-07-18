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

/**
 * Format a string using `util.format`-style specifiers.
 *
 * Supported specifiers: `%s` (string), `%d`/`%f` (number), `%i` (integer), `%j`/`%o`/`%O`
 * (JSON via {@link Options.stringify}), `%c` (CSS → ANSI styling) and `%%` (literal percent).
 * Unknown specifiers are passed through verbatim and do **not** consume an argument, matching
 * Node's `util.format` behaviour. Custom specifiers can be added via {@link Options.formatters}.
 *
 * When `fmt` is an object (rather than a string) the object and every argument are JSON-stringified
 * and joined with a single space, e.g. `format({ a: 1 }, ["b"])` returns `'{"a":1} "b"'`.
 * @example
 * ```ts
 * format("hello %s, you are %d", ["world", 42]); // "hello world, you are 42"
 * ```
 * @param fmt The format string, or an object to be stringified.
 * @param arguments_ The values to interpolate into `fmt`.
 * @param options Optional behaviour overrides — see {@link Options}.
 * @returns The formatted string.
 * @throws {TypeError} If `fmt` is neither a string nor a non-null object.
 */
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

    // `%c` is honoured when color is not explicitly disabled. By default it follows the historic
    // behaviour of only emitting ANSI outside of a browser-like global (`globalThis.window`).
    // Setting `options.colors` to a boolean overrides that heuristic in either direction.
    const colorsEnabled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        = options.colors ?? globalThis.window === undefined;

    for (let index = 0; index < fmt.length;) {
        // The loop guard `index + 1 < fmt.length` ensures `codePointAt(index + 1)` is defined.
        if (fmt.codePointAt(index) === CHAR_PERCENT && index + 1 < fmt.length) {
            lastPosition = lastPosition > -1 ? lastPosition : 0;

            const c = fmt.codePointAt(index + 1) as number;

            switch (c) {
                case CHAR_c: {
                    // Inspired by Deno's handling of '%c'.
                    // eslint-disable-next-line no-secrets/no-secrets
                    // https://github.com/denoland/deno/blob/ece2a3de5b19588160634452638aa656218853c5/ext/console/01_console.js#L3115
                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    if (colorsEnabled) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        const css = parseCss(arguments_[a as keyof typeof arguments_]);

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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const dValue = arguments_[a as keyof typeof arguments_];

                    // eslint-disable-next-line eqeqeq
                    if (a >= arguments_.length || dValue == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

                    result += (typeof dValue === "symbol" ? Number.NaN : Number(dValue)).toString();
                    lastPosition = index + 2;

                    index += 1;
                    break;
                }
                case CHAR_i: {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const iValue = arguments_[a as keyof typeof arguments_];

                    // eslint-disable-next-line eqeqeq
                    if (a >= arguments_.length || iValue == undefined) {
                        break;
                    }

                    if (lastPosition < index) {
                        result += fmt.slice(lastPosition, index);
                    }

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

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const sValue = arguments_[a as keyof typeof arguments_];

                    result += typeof sValue === "object" && sValue !== null ? stringify(sValue) : String(sValue);
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
                    } else {
                        // Unknown specifier with no custom formatter: pass `%x` through verbatim and
                        // do NOT consume an argument (matches Node's `util.format`). Cancel the
                        // unconditional `a += 1` below so later specifiers stay aligned.
                        a -= 1;
                    }
                }
            }

            a += 1;
        }

        index += 1;
    }

    if (lastPosition === -1 && !(options.appendExtraArguments && a < arguments_.length)) {
        return fmt;
    }

    if (lastPosition === -1) {
        result = fmt;
    } else if (lastPosition < fmt.length) {
        result += fmt.slice(lastPosition);
    }

    if (lastPosition !== -1 && usedStyle) {
        result += "\u001B[0m";
    }

    // Opt-in: append any arguments that were not consumed by a specifier, space-separated, the way
    // Node's `util.format("hi", err)` appends leftover values. `a` holds the count of consumed args.
    if (options.appendExtraArguments && a < arguments_.length) {
        for (let index = Math.max(a, 0); index < arguments_.length; index += 1) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const extra = arguments_[index];

            result += ` ${typeof extra === "object" && extra !== null ? stringify(extra) : String(extra)}`;
        }
    }

    return result;
};

/**
 * Build a {@link format}-compatible function with custom specifiers baked in.
 *
 * Each key in `options.formatters` must be a single character; it becomes a `%char` specifier
 * whose value is run through the supplied function. The returned function has the same signature as
 * {@link format} but pre-resolves the formatter map for speed, making it ideal for loggers.
 * @example
 * ```ts
 * const f = build({ formatters: { t: (ms) => new Date(ms).toISOString() } });
 * f("at %t", [Date.now()]);
 * ```
 * @param options Build-time options, including the custom `formatters` map.
 * @returns A reusable format function.
 * @throws {Error} If a formatter key is empty or longer than one character.
 * @throws {TypeError} If a formatter value is not a function.
 */
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

    // `build` exists to be the pre-optimized hot path for loggers, so avoid allocating a new
    // options object on every call: reuse one frozen base when the caller passes no per-call
    // `formatOptions`, and only spread when they actually do. Build-time options other than
    // `formatters` (e.g. `stringify`, `colors`, `appendExtraArguments`) are carried over.
    const rest = { ...options };

    delete rest.formatters;

    const baseOptions: Options = Object.freeze({ ...rest, formatters });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (f: NonNullable<Record<string, any> | string>, arguments_: any[] = [], formatOptions?: Omit<Options, "formatters">) => {
        if (formatOptions === undefined) {
            return format(f, arguments_, baseOptions);
        }

        return format(f, arguments_, { ...rest, ...formatOptions, formatters });
    };
};

/**
 * A custom specifier formatter: receives the matched argument and returns its string form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormatterFunction = (argument: any) => string;

/**
 * Internal map of custom formatters keyed by the specifier character's codepoint, as produced by
 * {@link build}.
 */
export type FormatterMap = Record<number, FormatterFunction>;

export interface Options {
    /**
     * Append any arguments not consumed by a specifier to the end of the output, space-separated,
     * mirroring Node's `util.format("hi", err)` behaviour. Objects are run through `stringify`.
     * @default false
     */
    appendExtraArguments?: boolean;

    /**
     * Force-enable or force-disable `%c` CSS → ANSI styling. When omitted, styling is emitted only
     * outside a browser-like environment (i.e. when `globalThis.window` is `undefined`). This is a
     * boolean gate only — it does not downsample truecolor sequences to 256/16 colors.
     * @default `globalThis.window === undefined`
     */
    colors?: boolean;

    /**
     * Custom specifier formatters, keyed by a single specifier character (e.g. `t` for `%t`). When
     * passed directly to {@link format}, the map must be keyed by codepoint (use {@link build} to
     * have keys converted for you).
     */
    formatters?: Record<string, FormatterFunction>;

    /**
     * Replacement serializer for `%j`, `%o` and `%O`. Defaults to a `JSON.stringify` wrapper that
     * emits `"[Circular]"` on throw. Use this to plug in safe/redacting stringifiers.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stringify?: (o: any) => string;
}
