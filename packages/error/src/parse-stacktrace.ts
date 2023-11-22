import type { TraceMap } from "@jridgewell/trace-mapping";

import loadSourceMap from "./load-source-map";
import type { Trace, TraceType } from "./types";

const debugLog = (message: string, ...arguments_: unknown[]): void => {
    if (process.env["DEBUG"] && String(process.env["DEBUG"]) === "true") {
        // eslint-disable-next-line no-console
        console.debug(`error:parse-stacktrace: ${message}`, ...arguments_);
    }
};

const UNKNOWN_FUNCTION = "<unknown>";

// at <SomeFramework>
// at <SomeFramework>:123:39
// -----------------
// at about:blank:1:7
// at index.js:23
// >= Chrome 99
// at /projects/foo.test.js:689:1 <- /projects/foo.test.js:10:1
// -----------------
// at bar (<anonymous>:1:19 <- <anonymous>:2:3)
// -----------------
// Chromium based browsers: Chrome, Brave, new Opera, new Edge
const CHROMIUM_REGEX =
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const CHROMIUM_EVAL_REGEX = /\((\S+)\),\s(<[^>]+>)?:(\d+)?:(\d+)?\)?/;
// foo.bar.js:123:39
// foo.bar.js:123:39 <- original.js:123:34
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const CHROMIUM_MAPPED = /(.*?):(\d+):(\d+)(\s<-\s(.+):(\d+):(\d+))?/;

// >= Chrome 88
// spy() at Component.Foo [as constructor] (original.js:123:34)
// spy() at Component.Foo [as constructor] (foo.bar.js:123:39 <- original.js:123:34)

// at foo.bar(bob) (foo.bar.js:123:39)
// at foo.bar(bob) (foo.bar.js:123:39 <- original.js:123:34)

// in AppProviders (at App.tsx:28)
// at Module.load (internal/modules/cjs/loader.js:641:32)
// eslint-disable-next-line security/detect-unsafe-regex
const NODE_REGEX = /\s*(at|in)\s(?:([^\\/]+(?:\s\[as\s\S+\])?)\s\(?)?\((.*?):(\d+)(?::(\d+))?\)?\s*$/;
const NODE_NESTED_REGEX = /in\s(.*)\s\(at\s(.+)\)\sat/;

// eslint-disable-next-line security/detect-unsafe-regex
const NAVTIE_REGEX = /^((\S.*)@)?(\[.*\])$/;

// eslint-disable-next-line regexp/no-super-linear-backtracking
const FIREFOX_WEBKIT_REGEX = /(\S[^\s[]*\[.*\]|.*?)@(.*):(\d+):(\d+)/;
const WEBKIT_ADDRESS_UNNAMED_REGEX = /^(http(s)?:\/\/.*):(\d+):(\d+)$/;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const REACT_ANDROID_NATIVE_REGEX = /^(?:.*@)?(.*):(\d+):(\d+)$/;
// eslint-disable-next-line security/detect-unsafe-regex
const GECKO_EVAL_REGEX = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;

// Used to sanitize webpack (error: *) wrapped stack errors
const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;

/**
 * Safari web extensions, starting version unknown, can produce "frames-only" stacktraces.
 * What it means, is that instead of format like:
 *
 * Error: wat
 *   at function@url:row:col
 *   at function@url:row:col
 *   at function@url:row:col
 *
 * it produces something like:
 *
 *   function@url:row:col
 *   function@url:row:col
 *   function@url:row:col
 *
 * Because of that, it won't be captured by `chrome` RegExp and will fall into `Gecko` branch.
 * This function is extracted so that we can use it in both places without duplicating the logic.
 * Unfortunately "just" changing RegExp is too complicated now and making it pass all tests
 * and fix this case seems like an impossible, or at least way too time-consuming task.
 */
const extractSafariExtensionDetails = (function_: string, url: string): [string, string] => {
    const isSafariExtension = function_.includes("safari-extension");
    const isSafariWebExtension = function_.includes("safari-web-extension");

    return isSafariExtension || isSafariWebExtension
        ? [
              function_.includes("@") ? (function_.split("@")[0] as string) : UNKNOWN_FUNCTION,
              isSafariExtension ? `safari-extension:${url}` : `safari-web-extension:${url}`,
          ]
        : [function_, url];
};

const parseMapped = (trace: Trace, maybeMapped: string) => {
    const match = CHROMIUM_MAPPED.exec(maybeMapped);

    if (match) {
        // eslint-disable-next-line no-param-reassign,prefer-destructuring
        trace.file = match[1];
        // eslint-disable-next-line no-param-reassign
        trace.line = +(<string>match[2]);
        // eslint-disable-next-line no-param-reassign
        trace.column = +(<string>match[3]);
    }
};

const parseNode = (line: string): Trace | undefined => {
    const nestedNode = NODE_NESTED_REGEX.exec(line);

    if (nestedNode) {
        debugLog(`parse nested node error stack line: "${line}"`, `found: ${JSON.stringify(nestedNode)}`);

        const split = (nestedNode[2] as string).split(":");

        return {
            column: split[2] ? +split[2] : undefined,
            file: split[0],
            line: split[1] ? +split[1] : undefined,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            methodName: nestedNode[1] || UNKNOWN_FUNCTION,
            raw: line,
            type: undefined,
        };
    }

    const node = NODE_REGEX.exec(line);

    if (node) {
        debugLog(`parse node error stack line: "${line}"`, `found: ${JSON.stringify(node)}`);

        const trace = {
            column: node[5] ? +node[5] : undefined,
            file: node[3] ? node[3].replace(/at\s/, "") : undefined,
            line: node[4] ? +node[4] : undefined,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            methodName: node[2] || UNKNOWN_FUNCTION,
            raw: line,
            type: undefined,
        };

        parseMapped(trace, `${node[3]}:${node[4]}:${node[5]}`);

        return trace;
    }

    return undefined;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseChromium = (line: string): Trace | undefined => {
    const parts = CHROMIUM_REGEX.exec(line) as (string | undefined)[] | null;

    if (parts) {
        debugLog(`parse chrome error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        const isNative = parts[2] && parts[2].startsWith("native"); // start of line
        const isEval = (parts[2] && parts[2].startsWith("eval")) || (parts[1] && parts[1].startsWith("eval")); // start of line

        let evalOrigin: Trace | undefined;

        if (isEval) {
            const subMatch = CHROMIUM_EVAL_REGEX.exec(line);

            if (subMatch) {
                // can be index.js:123:39 or index.js:123 or index.js
                const split = /(\S+):(\d+):(\d+)|(\S+):(\d+)$/.exec(subMatch[1] as string);

                if (split) {
                    // throw out eval line/column and use top-most line/column number
                    parts[2] = split[4] ?? split[1]; // url
                    parts[3] = split[5] ?? split[2]; // line
                    // eslint-disable-next-line prefer-destructuring
                    parts[4] = split[3]; // column
                }

                if (subMatch[2]) {
                    evalOrigin = {
                        column: subMatch[4] ? +subMatch[4] : undefined,
                        file: subMatch[2],
                        line: subMatch[3] ? +subMatch[3] : undefined,
                        methodName: "eval",
                        raw: line,
                        type: "eval",
                    };
                }
            }
        }

        const trace = {
            column: parts[4] ? +parts[4] : undefined,
            evalOrigin,
            file: parts[2],
            line: parts[3] ? +parts[3] : undefined,
            // Normalize IE's 'Anonymous function'
            methodName: parts[1] ? parts[1].replace(/^Anonymous function$/, "<anonymous>") : UNKNOWN_FUNCTION,
            raw: line,
            type: (isEval ? "eval" : isNative ? "native" : undefined) as TraceType,
        };

        parseMapped(trace, `${parts[2]}:${parts[3]}:${parts[4]}`);

        return trace;
    }

    return undefined;
};

const parseFirefoxWebkit = (line: string): Trace | undefined => {
    const parts = FIREFOX_WEBKIT_REGEX.exec(line);

    if (parts) {
        debugLog(`parse firefox error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        const isEval = parts[2]?.includes(" > eval");
        const subMatch = parts[2] ? GECKO_EVAL_REGEX.exec(parts[2]) : null;

        let evalOrigin: Trace | undefined;

        if (isEval && subMatch !== null) {
            // throw out eval line/column and use top-most line number
            parts[2] = <string>subMatch[1];
            parts[3] = <string>subMatch[2];

            evalOrigin = {
                column: undefined,
                file: parts[2],
                line: +parts[3],
                methodName: "eval",
                raw: line,
                type: "eval",
            };
        }

        return {
            column: !isEval && parts[4] ? +parts[4] : undefined, // no column when eval
            evalOrigin,
            file: parts[2],
            line: parts[3] ? +parts[3] : undefined,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            methodName: parts[1] || UNKNOWN_FUNCTION,
            raw: line,
            type: isEval ? "eval" : parts[0] ? undefined : "native",
        };
    }

    const webkitParts = WEBKIT_ADDRESS_UNNAMED_REGEX.exec(line);

    if (webkitParts) {
        debugLog(`parse webkit address unnamed error stack line: "${line}"`, `found: ${JSON.stringify(webkitParts)}`);

        return {
            column: webkitParts[4] ? +webkitParts[4] : undefined,
            file: webkitParts[1],
            line: webkitParts[3] ? +webkitParts[3] : undefined,
            methodName: UNKNOWN_FUNCTION,
            raw: line,
            type: undefined,
        };
    }

    return undefined;
};

const parseReactAndroidNative = (line: string): Trace | undefined => {
    const parts = REACT_ANDROID_NATIVE_REGEX.exec(line);

    if (parts) {
        debugLog(`parse react android native error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        return {
            column: parts[3] ? +parts[3] : undefined,
            file: parts[1],
            line: parts[2] ? +parts[2] : undefined,
            methodName: UNKNOWN_FUNCTION,
            raw: line,
            type: undefined,
        };
    }

    const native = NAVTIE_REGEX.exec(line);

    if (native) {
        debugLog(`parse native error stack line: "${line}"`, `found: ${JSON.stringify(native)}`);

        return {
            column: undefined,
            file: native[3],
            line: undefined,
            methodName: native[2] ?? UNKNOWN_FUNCTION,
            raw: line,
            type: native[3] && (native[3].startsWith("[native") as boolean) ? "native" : undefined,
        };
    }

    const atParts = /^\s*at\s(\w+)/.exec(line);

    if (atParts) {
        debugLog(`parse at error stack line: "${line}"`, `found: ${JSON.stringify(atParts)}`);

        return {
            column: undefined,
            file: undefined,
            line: undefined,
            methodName: atParts[1],
            raw: line,
            type: undefined,
        };
    }

    return undefined;
};

const parseOpera = (e: Error): Trace => {
    // @ts-expect-error missing stacktrace property
    if (!e.stacktrace || (e.message.includes("\n") && e.message.split("\n").length > e.stacktrace.split("\n").length)) return parseOpera9(e);
    if (!e.stack) return parseOpera10(e);
    return parseOpera11(e);
};

const parseOpera9 = (e: Error) => {
    const lineRE = /Line (\d+).*script (?:in )?(\S+)/i;
    const lines = e.message.split("\n");
    const result: StackFrame[] = [];

    for (let index = 2, length_ = lines.length; index < length_; index += 2) {
        const match = lineRE.exec(lines[index]);
        if (match) {
            result.push({
                fileName: match[2],
                lineNumber: +match[1],
                source: lines[index],
            });
        }
    }

    return result;
};

const parseOpera10 = (e: Error) => {
    const lineRE = /Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;
    // @ts-expect-error missing stack property
    const lines = e.stacktrace.split("\n");
    const result: StackFrame[] = [];

    for (let index = 0, length_ = lines.length; index < length_; index += 2) {
        const match = lineRE.exec(lines[index]);
        if (match) {
            result.push({
                fileName: match[2],
                functionName: match[3] || undefined,
                lineNumber: match[1] ? +match[1] : undefined,
                source: lines[index],
            });
        }
    }

    return result;
};

// Opera 10.65+ Error.stack very similar to FF/Safari
const parseOpera11 = (error: Error) => {
    // @ts-expect-error missing stack property
    const filtered = error.stack.split("\n").filter((line) => !!line.match(FIREFOX_SAFARI_STACK_REGEXP) && !line.startsWith("Error created at"));

    return filtered.map<StackFrame>((line) => {
        const tokens = line.split("@");
        const locationParts = extractLocation(tokens.pop()!);
        const functionCall = tokens.shift() || "";
        const functionName = functionCall.replace(/<anonymous function(: (\w+))?>/, "$2").replaceAll(/\([^)]*\)/g, "") || undefined;

        let argumentsRaw;

        if (/\(([^)]*)\)/.test(functionCall)) {
            argumentsRaw = functionCall.replace(/^[^(]+\(([^)]*)\)$/, "$1");
        }

        const arguments_ = argumentsRaw === undefined || argumentsRaw === "[arguments not available]" ? undefined : argumentsRaw.split(",");

        return {
            args: arguments_,
            columnNumber: locationParts[2] ? +locationParts[2] : undefined,
            fileName: locationParts[0],
            functionName,
            lineNumber: locationParts[1] ? +locationParts[1] : undefined,
            source: line,
        };
    });
};

const parse = (error: Error, options: Partial<{ frameLimit: number; sourcemap: boolean }> = {}): Trace[] => {
    const { frameLimit = 50, sourcemap = false } = options;

    // @ts-expect-error missing stacktrace property
    let lines = (error.stacktrace ?? error.stack ?? "")
        .split("\n")
        .map((line: string): string => {
            // https://github.com/getsentry/sentry-javascript/issues/5459
            // Remove webpack (error: *) wrappers
            const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, "$1") : line;

            // eslint-disable-next-line unicorn/prefer-string-replace-all
            return cleanedLine.replace(/^\s+|\s+$/g, "");
        })
        // https://github.com/getsentry/sentry-javascript/issues/7813
        // Skip Error: lines
        .filter((line: string): boolean => !/\S*Error: /.test(line));

    if (lines.length > frameLimit) {
        lines = lines.slice(0, frameLimit);
    }

    // eslint-disable-next-line unicorn/no-array-reduce,@typescript-eslint/no-unsafe-return
    return lines.reduce((stack: Trace[], line: string): Trace[] => {
        if (!line) {
            return stack;
        }

        // Ignore lines over 1kb as they are unlikely to be stack frames.
        // Many of the regular expressions use backtracking which results in run time that increases exponentially with
        // input size. Huge strings can result in hangs/Denial of Service:
        // https://github.com/getsentry/sentry-javascript/issues/2286
        if (line.length > 1024) {
            return stack;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const parseResult = parseChromium(line) || parseFirefoxWebkit(line) || parseNode(line) || parseReactAndroidNative(line);

        if (parseResult) {
            stack.push(parseResult);
        } else {
            debugLog(`parse error stack line: "${line}"`, "not parser found");
        }

        return stack;
    }, []);
};

export default parse;
