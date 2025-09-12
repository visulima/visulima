import type { Trace, TraceType } from "./types";

type TopFrameMeta = {
    column?: number;
    line?: number;
    type: "firefox" | "safari";
};

const debugLog = (message: string, ...arguments_: unknown[]): void => {
    if (process.env.DEBUG && String(process.env.DEBUG) === "true") {
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
// at foo.bar(bob) (foo.bar.js:123:39)
// at foo.bar(bob) (foo.bar.js:123:39 <- original.js:123:34)
// -----------------
// >= Chrome 88
// spy() at Component.Foo [as constructor] (original.js:123:34)
// spy() at Component.Foo [as constructor] (foo.bar.js:123:39 <- original.js:123:34)
// -----------------
// at Module.load (internal/modules/cjs/loader.js:641:32)
// -----------------
// Chromium based browsers: Chrome, Brave, new Opera, new Edge
const CHROMIUM_REGEX
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    = /^.*?\s*at\s(?:(.+?\)(?:\s\[.+\])?|\(?.*?)\s?\((?:address\sat\s)?)?(?:async\s)?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const CHROMIUM_EVAL_REGEX = /\((\S+)\),\s(<[^>]+>)?:(\d+)?:(\d+)?\)?/;
// foo.bar.js:123:39
// foo.bar.js:123:39 <- original.js:123:34
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const CHROMIUM_MAPPED = /(.*?):(\d+):(\d+)(\s<-\s(.+):(\d+):(\d+))?/;

// eval at <anonymous> (C:\\Users\\user\\project\\visulima\\packages\\error\\__tests__\\stacktrace\\parse-stacktrace.test.ts
// eslint-disable-next-line regexp/optimal-quantifier-concatenation,regexp/no-unused-capturing-group,security/detect-unsafe-regex
const WINDOWS_EVAL_REGEX = /(eval)\sat\s(<anonymous>)\s\((.*)\)?:(\d+)?:(\d+)\),\s*(<anonymous>)?:(\d+)?:(\d+)/;

// in AppProviders (at App.tsx:28)
// eslint-disable-next-line security/detect-unsafe-regex
const NODE_REGEX = /^\s*in\s(?:([^\\/]+(?:\s\[as\s\S+\])?)\s\(?)?\(at?\s?(.*?):(\d+)(?::(\d+))?\)?\s*$/;
const NODE_NESTED_REGEX = /in\s(.*)\s\(at\s(.+)\)\sat/;

// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const REACT_ANDROID_NATIVE_REGEX = /^(?:.*@)?(.*):(\d+):(\d+)$/;

// gecko regex: `(?:bundle|\d+\.js)`: `bundle` is for react native, `\d+\.js` also but specifically for ram bundles because it
// generates filenames without a prefix like `file://` the filenames in the stacktrace are just 42.js
// We need this specific case for now because we want no other regex to match.
// eslint-disable-next-line regexp/no-super-linear-backtracking,security/detect-unsafe-regex,regexp/no-optional-assertion,regexp/no-trivially-nested-quantifier,regexp/no-useless-escape,no-useless-escape,regexp/optimal-quantifier-concatenation
const GECKO_REGEX = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. \/=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const GECKO_EVAL_REGEX = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;

// @http://localhost:8080/file.js:33:9
// foo@debugger eval code:1:27
// obj["@fn"]@Scratchpad/1:10:29
// eslint-disable-next-line regexp/no-super-linear-backtracking
const FIREFOX_REGEX = /(\S[^\s[]*\[.*\]|.*?)@(.*):(\d+):(\d+)/;

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
const extractSafariExtensionDetails = (methodName: string, url: string): [string, string] => {
    const isSafariExtension = methodName.includes("safari-extension");
    const isSafariWebExtension = methodName.includes("safari-web-extension");

    return isSafariExtension || isSafariWebExtension
        ? [
            methodName.includes("@") ? (methodName.split("@")[0] as string) : UNKNOWN_FUNCTION,
            isSafariExtension ? `safari-extension:${url}` : `safari-web-extension:${url}`,
        ]
        : [methodName, url];
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

            methodName: nestedNode[1] || UNKNOWN_FUNCTION,
            raw: line,
            type: undefined,
        };
    }

    const node = NODE_REGEX.exec(line);

    if (node) {
        debugLog(`parse node error stack line: "${line}"`, `found: ${JSON.stringify(node)}`);

        const trace = {
            column: node[4] ? +node[4] : undefined,
            file: node[2] ? node[2].replace(/at\s/, "") : undefined,
            line: node[3] ? +node[3] : undefined,

            methodName: node[1] || UNKNOWN_FUNCTION,
            raw: line,
            type: line.startsWith("internal") ? ("internal" as TraceType) : undefined,
        };

        parseMapped(trace, `${node[2] as string}:${node[3] as string}:${node[4] as string}`);

        return trace;
    }

    return undefined;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseChromium = (line: string): Trace | undefined => {
    const parts = CHROMIUM_REGEX.exec(line) as (string | undefined)[] | null;

    if (parts) {
        debugLog(`parse chrome error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        const isNative = parts[2]?.startsWith("native"); // start of line

        const isEval = parts[2]?.startsWith("eval") || parts[1]?.startsWith("eval"); // start of line

        let evalOrigin: Trace | undefined;
        let windowsParts:
            | {
                column: number | undefined;
                file: string | undefined;
                line: number | undefined;
            }
            | undefined;

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
                } else if (subMatch[2]) {
                    // eslint-disable-next-line prefer-destructuring
                    parts[2] = subMatch[1];
                }

                if (subMatch[2]) {
                    evalOrigin = {
                        column: subMatch[4] ? +subMatch[4] : undefined,
                        file: subMatch[2],
                        line: subMatch[3] ? +subMatch[3] : undefined,
                        methodName: "eval",
                        raw: line,
                        type: "eval" as TraceType,
                    };
                }
            } else {
                const windowsSubMatch = WINDOWS_EVAL_REGEX.exec(line);

                if (windowsSubMatch) {
                    windowsParts = {
                        column: windowsSubMatch[5] ? +windowsSubMatch[5] : undefined,
                        file: windowsSubMatch[3],
                        line: windowsSubMatch[4] ? +windowsSubMatch[4] : undefined,
                    };

                    evalOrigin = {
                        column: windowsSubMatch[8] ? +windowsSubMatch[8] : undefined,
                        file: windowsSubMatch[2],
                        line: windowsSubMatch[7] ? +windowsSubMatch[7] : undefined,
                        methodName: "eval",
                        raw: windowsSubMatch[0],
                        type: "eval" as TraceType,
                    };
                }
            }
        }

        const [methodName, file] = extractSafariExtensionDetails(
            // Normalize IE's 'Anonymous function'
            parts[1] ? parts[1].replace(/^Anonymous function$/, "<anonymous>") : UNKNOWN_FUNCTION,
            parts[2] as string,
        );

        const trace = {
            column: parts[4] ? +parts[4] : undefined,
            evalOrigin,
            file,
            line: parts[3] ? +parts[3] : undefined,
            methodName,
            raw: line,
            type: (isEval ? "eval" : isNative ? "native" : undefined) as TraceType,
        };

        if (windowsParts) {
            trace.column = windowsParts.column;
            trace.file = windowsParts.file as string;
            trace.line = windowsParts.line;
        } else {
            parseMapped(trace, `${file}:${parts[3] as string}:${parts[4] as string}`);
        }

        return trace;
    }

    return undefined;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseGecko = (line: string, topFrameMeta?: TopFrameMeta): Trace | undefined => {
    const parts = GECKO_REGEX.exec(line);

    if (parts) {
        debugLog(`parse gecko error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        const isEval = parts[3]?.includes(" > eval");
        const subMatch = isEval && parts[3] && GECKO_EVAL_REGEX.exec(parts[3]);

        let evalOrigin: Trace | undefined;

        if (isEval && subMatch) {
            // overwrite file
            parts[3] = <string>subMatch[1];

            evalOrigin = {
                column: parts[5] ? +parts[5] : undefined,
                file: parts[3],
                line: parts[4] ? +parts[4] : undefined,
                methodName: "eval",
                raw: line,
                type: "eval" as TraceType,
            };

            // overwrite line
            parts[4] = <string>subMatch[2];
        }

        const [methodName, file] = extractSafariExtensionDetails(
            // Normalize IE's 'Anonymous function'
            parts[1] ? parts[1].replace(/^Anonymous function$/, "<anonymous>") : UNKNOWN_FUNCTION,
            parts[3] as string,
        );

        let column: number | undefined; // no column when eval

        if ((topFrameMeta?.type === "safari" || (!isEval && topFrameMeta?.type === "firefox")) && topFrameMeta.column) {
            column = topFrameMeta.column;
        } else if (!isEval && parts[5]) {
            column = +parts[5];
        }

        let lineNumber: number | undefined; // no line when eval

        if ((topFrameMeta?.type === "safari" || (!isEval && topFrameMeta?.type === "firefox")) && topFrameMeta.line) {
            lineNumber = topFrameMeta.line;
        } else if (parts[4]) {
            lineNumber = +parts[4];
        }

        return {
            column,
            evalOrigin,
            file,
            line: lineNumber,
            methodName,
            raw: line,
            type: isEval ? "eval" : file.includes("[native code]") ? "native" : undefined,
        };
    }

    return undefined;
};

const parseFirefox = (line: string, topFrameMeta?: TopFrameMeta): Trace | undefined => {
    const parts = FIREFOX_REGEX.exec(line);

    const isEval = parts ? (parts[2] as string).includes(" > eval") : false;

    if (!isEval && parts) {
        debugLog(`parse firefox error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        return {
            column: parts[4] ? +parts[4] : topFrameMeta?.column ?? undefined,
            file: parts[2],
            line: parts[3] ? +parts[3] : topFrameMeta?.line ?? undefined,

            methodName: parts[1] || UNKNOWN_FUNCTION,
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

    return undefined;
};

const parse = (error: Error, { filter, frameLimit = 50 }: Partial<{ filter?: (line: string) => boolean; frameLimit: number }> = {}): Trace[] => {
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
        // Skip AggregateError: lines
        // Skip eval code without more context
        .filter((line: string): boolean => !/\S*(?:Error: |AggregateError:)/.test(line) && line !== "eval code");

    if (filter) {
        lines = lines.filter((element: string) => filter(element));
    }

    lines = lines.slice(0, frameLimit);

    // eslint-disable-next-line unicorn/no-array-reduce
    return lines.reduce((stack: Trace[], line: string, currentIndex: number): Trace[] => {
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

        let parseResult: Trace | undefined;

        if (/^\s*in\s.*/.test(line)) {
            parseResult = parseNode(line);
            // eslint-disable-next-line regexp/no-super-linear-backtracking
        } else if (/^.*?\s*at\s.*/.test(line)) {
            parseResult = parseChromium(line);
            // eslint-disable-next-line regexp/no-super-linear-backtracking
        } else if (/^.*?\s*@.*|\[native code\]/.test(line)) {
            let topFrameMeta: TopFrameMeta | undefined;

            if (currentIndex === 0) {
                // @ts-expect-error columnNumber and lineNumber property only exists on Firefox
                if (error.columnNumber || error.lineNumber) {
                    topFrameMeta = {
                        // @ts-expect-error columnNumber and columnNumber property only exists on Firefox
                        column: error.columnNumber,
                        // @ts-expect-error columnNumber and lineNumber property only exists on Firefox
                        line: error.lineNumber,
                        type: "firefox",
                    };
                    // @ts-expect-error line and column property only exists on safari
                } else if (error.line || error.column) {
                    topFrameMeta = {
                        // @ts-expect-error column property only exists on safari
                        column: error.column,
                        // @ts-expect-error line property only exists on safari
                        line: error.line,
                        type: "safari",
                    };
                }
            }

            parseResult

                = parseFirefox(line, topFrameMeta) || parseGecko(line, topFrameMeta);
        } else {
            parseResult = parseReactAndroidNative(line);
        }

        if (parseResult) {
            stack.push(parseResult);
        } else {
            debugLog(`parse error stack line: "${line}"`, "not parser found");
        }

        return stack;
    }, []);
};

export default parse;
