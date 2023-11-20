import { existsSync, readFileSync } from "node:fs";

import type { TraceMap } from "@jridgewell/trace-mapping";

import loadSourceMap from "./load-source-map";
import type { SourceCode, Trace, TraceType } from "./types";

const debugLog = (message: string, ...arguments_: unknown[]): void => {
    if (process.env["DEBUG"] && String(process.env["DEBUG"]) === "true") {
        // eslint-disable-next-line no-console
        console.debug(`error:parse-stacktrace: ${message}`, ...arguments_);
    }
};

const UNKNOWN_FUNCTION = "<unknown>";
const MAX_CODE_LINES = 6;

// at <SomeFramework>
const CHROME_IE_NATIVE_NO_LINE = /^at\s(<.*>)$/;
// at <SomeFramework>:123:39
const CHROME_IE_NATIVE = /^\s*at\s(<.*>):(\d+):(\d+)$/;
const CHROME_IE_DETECTOR = /\s*at\s.+/;
// at about:blank:1:7
// at index.js:23
// >= Chrome 99
// at /projects/foo.test.js:689:1 <- /projects/foo.test.js:10:1
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-misleading-capturing-group,regexp/no-super-linear-backtracking
const CHROME_BLANK = /\s*at\s(.*):(\d+):?(\d+)?$/;
// at bar (<anonymous>:1:19 <- <anonymous>:2:3)
const CHROME_IE_REGEX =
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    /^\s*at\s(.*?)\s?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-zA-Z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/;
// eslint-disable-next-line security/detect-unsafe-regex
const CHROME_EVAL_REGEX = /\((\S*):(\d+):(\d+)\)|\((\S*):?(\d+)?\)(,\s)?(<[^>]+>)?:(\d+)?:(\d+)?\)?/;
const CHROME_NESTED_EVAL_REGEX = /\sat\s(\S+)\s\((.*)\)\)?,?\s?(<.*>):(\d+):(\d+)\)?/;
// foo.bar.js:123:39
// foo.bar.js:123:39 <- original.js:123:34
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const CHROME_MAPPED = /(.*?):(\d+):(\d+)(\s<-\s(.+):(\d+):(\d+))?/;

// >= Chrome 88
// spy() at Component.Foo [as constructor] (original.js:123:34)
// spy() at Component.Foo [as constructor] (foo.bar.js:123:39 <- original.js:123:34)

// at foo.bar(bob) (foo.bar.js:123:39)
// at foo.bar(bob) (foo.bar.js:123:39 <- original.js:123:34)

// in AppProviders (at App.tsx:28)
// at Module.load (internal/modules/cjs/loader.js:641:32)
// eslint-disable-next-line security/detect-unsafe-regex
const NODE_REGEX = /^\s*(at|in)\s(?:([^\\/]+(?:\s\[as\s\S+\])?)\s\(?)?\((.*?):(\d+)(?::(\d+))?\)?\s*$/;
const NODE_NESTED_REGEX = /in\s(.*)\s\(at\s(.+)\)\sat/;

// eslint-disable-next-line security/detect-unsafe-regex
const NAVTIE_REGEX = /^((\S.*)@)?(\[.*\])$/;

// eslint-disable-next-line regexp/no-super-linear-backtracking
const FIREFOX_WEBKIT_REGEX = /(\S[^\s[]*\[.*\]|.*?)@(.*):(\d+):(\d+)/;
const WEBKIT_ADDRESS_UNNAMED_REGEX = /^(http(s)?:\/\/.*):(\d+):(\d+)$/;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const REACT_ANDROID_NATIVE_REGEX = /^(?:.*@)?(.*):(\d+):(\d+)$/;

const readFileContext = (path: string | undefined): string => {
    if (!path) {
        return "";
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(path)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return readFileSync(path, "utf8");
    }

    return "";
};

const getSourceCode = (path: string | undefined, line: number): SourceCode | undefined => {
    const context = readFileContext(path);

    if (!context) {
        return undefined;
    }

    const linesOfCode: string[] = context.split("\n");

    const code: string = linesOfCode[lineNumber - 1] as string;
    const preCode: string[] = linesOfCode.slice(lineNumber - MAX_CODE_LINES, lineNumber - 1);
    const postCode: string[] = linesOfCode.slice(lineNumber, lineNumber + MAX_CODE_LINES);

    return {
        code,
        postCode,
        preCode,
    };
};

const parseMapped = (trace: Trace, maybeMapped: string) => {
    const match = CHROME_MAPPED.exec(maybeMapped);

    if (match) {
        // eslint-disable-next-line no-param-reassign,prefer-destructuring
        trace.file = match[1];
        // eslint-disable-next-line no-param-reassign
        trace.line = +(<string>match[2]);
        // eslint-disable-next-line no-param-reassign
        trace.column = +(<string>match[3]);

        const sourceOrigin = {
            column: match[7] ? +match[7] : undefined,
            file: match[5],
            line: match[6] ? +match[6] : undefined,
        };

        if (sourceOrigin.file) {
            // eslint-disable-next-line no-param-reassign
            trace.sourceOrigin = sourceOrigin;
        }
    }
};

const parseNode = (line: string): Trace | undefined => {
    const nestedNode = NODE_NESTED_REGEX.exec(line);

    if (nestedNode) {
        debugLog(`parse nested node error stack line: "${line}"`, `found: ${JSON.stringify(nestedNode)}`);

        const split = (nestedNode[2] as string).split(":");

        return {
            args: [],
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
            args: [],
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

const parseNestedEval = (line: string): Trace | undefined => {
    let parts: RegExpExecArray | null = CHROME_NESTED_EVAL_REGEX.exec(line);

    if (!parts) {
        const subMatch = CHROME_EVAL_REGEX.exec(line as string);

        if (subMatch) {
            parts = [] as unknown as RegExpExecArray;

            parts[1] = "eval"; // methodName
            parts[3] = <string>subMatch[1]; // url
            parts[4] = <string>subMatch[2]; // line
            parts[5] = <string>subMatch[3]; // column
        }
    }

    debugLog(`parse chrome nested eval error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    return {
        args: [],
        column: parts[5] ? +parts[5] : undefined,
        evalOrigin: parts[2] ? parseNestedEval(parts[2]) : undefined,
        file: parts[3],
        line: parts[4] ? +parts[4] : undefined,
        methodName: parts[1],
        raw: line,
        type: "eval",
    };
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseChromeIe = (line: string): Trace | undefined => {
    if (CHROME_IE_DETECTOR.test(line)) {
        const nativeNoLine = CHROME_IE_NATIVE_NO_LINE.exec(line);

        if (nativeNoLine) {
            debugLog(`parse chrome native no line error stack line: "${line}"`, `found: ${JSON.stringify(nativeNoLine)}`);

            return {
                args: [],
                column: undefined,
                file: nativeNoLine[1],
                line: undefined,
                methodName: UNKNOWN_FUNCTION,
                raw: line,
                type: "native",
            };
        }

        const native = CHROME_IE_NATIVE.exec(line);

        if (native) {
            debugLog(`parse chrome native error stack line: "${line}"`, `found: ${JSON.stringify(native)}`);

            return {
                args: [],
                column: native[3] ? +native[3] : undefined,
                file: native[1],
                line: native[2] ? +native[2] : undefined,
                methodName: UNKNOWN_FUNCTION,
                raw: line,
                type: "native",
            };
        }

        const parts = CHROME_IE_REGEX.exec(line);

        if (parts) {
            debugLog(`parse chrome error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

            const isNative = parts[2] && parts[2].startsWith("native"); // start of line
            const isEval = (parts[2] && parts[2].startsWith("eval")) || (parts[1] && parts[1].startsWith("eval")); // start of line

            let evalOrigin: Trace | undefined;

            if (isEval) {
                const isNestedEval = parts[2] && parts[2].startsWith("eval at"); // start of line

                const subMatch = CHROME_EVAL_REGEX.exec(line);

                debugLog(`parse chrome eval error stack line: "${line}"`, subMatch === null ? "not found" : `found: ${JSON.stringify(subMatch)}`);

                if (subMatch && (subMatch[7] || subMatch[4]) && (subMatch[9] || subMatch[2] || subMatch[8])) {
                    evalOrigin = {
                        args: [],
                        column: subMatch[9] ? +subMatch[9] : undefined,
                        file: subMatch[7] ?? subMatch[4],
                        line: subMatch[8] ? +subMatch[8] : subMatch[2] ? +subMatch[2] : undefined,
                        methodName: "eval",
                        raw: line,
                        type: "eval",
                    } as Trace;
                } else if (isNestedEval) {
                    evalOrigin = parseNestedEval(line);
                }

                if (subMatch) {
                    // throw out eval line/column and use top-most line/column number
                    parts[2] = subMatch[1] ?? (subMatch[4] as string); // url
                    parts[3] = <string>subMatch[2]; // line
                    parts[4] = <string>subMatch[3]; // column
                }
            }

            const trace = {
                args: isNative ? [parts[2]] : [],
                column: parts[4] ? +parts[4] : undefined,
                evalOrigin,
                file: isNative ? undefined : parts[2],
                line: parts[3] ? +parts[3] : undefined,
                // Normalize IE's 'Anonymous function'
                methodName: parts[1] ? parts[1].replace(/^Anonymous function$/, "<anonymous>") : UNKNOWN_FUNCTION,
                raw: line,
                type: (isEval ? "eval" : isNative ? "native" : undefined) as TraceType,
            };

            parseMapped(trace, `${parts[2]}:${parts[3]}:${parts[4]}`);

            return trace;
        }

        const blank = CHROME_BLANK.exec(line);

        if (blank) {
            debugLog(`parse chrome blank error stack line: "${line}"`, `found: ${JSON.stringify(blank)}`);

            const trace = {
                args: [],
                column: blank[3] ? +blank[3] : undefined,
                file: blank[1],
                line: blank[2] ? +blank[2] : undefined,
                methodName: UNKNOWN_FUNCTION,
                raw: line,
                type: undefined,
            };

            parseMapped(trace, `${blank[1]}:${blank[2]}:${blank[3]}`);

            return trace;
        }
    }

    return undefined;
};

const parseFirefoxWebkit = (line: string): Trace | undefined => {
    const parts = FIREFOX_WEBKIT_REGEX.exec(line);

    if (parts) {
        debugLog(`parse firefox webkit error stack line: "${line}"`, `found: ${JSON.stringify(parts)}`);

        return {
            args: [],
            column: parts[4] ? +parts[4] : undefined,
            file: parts[2],
            line: parts[3] ? +parts[3] : undefined,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            methodName: parts[1] || UNKNOWN_FUNCTION,
            raw: line,
            type: parts[0] ? undefined : "native",
        };
    }

    const webkitParts = WEBKIT_ADDRESS_UNNAMED_REGEX.exec(line);

    if (webkitParts) {
        debugLog(`parse webkit address unnamed error stack line: "${line}"`, `found: ${JSON.stringify(webkitParts)}`);

        return {
            args: [],
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
            args: [],
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
            args: [],
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
            args: [],
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

const parse = (error: Error, options: Partial<{ sourcemap: boolean }> = {}): Trace[] => {
    // @ts-expect-error missing stacktrace property
    const lines = (error.stacktrace ?? error.stack ?? "")
        .split("\n")
        .filter(Boolean)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .map((line: string): string => line.replace(/^\s+|\s+$/g, ""));

    // eslint-disable-next-line unicorn/no-array-reduce,@typescript-eslint/no-unsafe-return
    return lines.reduce((stack: Trace[], line: string): Trace[] => {
        if (!line) {
            return stack;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const parseResult = parseChromeIe(line) || parseFirefoxWebkit(line) || parseNode(line) || parseReactAndroidNative(line);

        if (parseResult) {
            stack.push(parseResult);
        } else {
            debugLog(`parse error stack line: "${line}"`, "not parser found");
        }

        return stack;
    }, []);
};

export default parse;
