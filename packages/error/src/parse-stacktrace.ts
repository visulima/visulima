import { existsSync, readFileSync } from "node:fs";

import type { TraceMap } from "@jridgewell/trace-mapping";

import loadSourceMap from "./load-source-map";
import type { SourceCode, Trace } from "./types";

const debugLog = (message: string, ...arguments_: unknown[]): void => {
    if (process.env["DEBUG"] && String(process.env["DEBUG"]) === "true") {
        // eslint-disable-next-line no-console
        console.debug(`error:parse-stacktrace: ${message}`, ...arguments_);
    }
};

const UNKNOWN_FUNCTION = "<unknown>";
const MAX_CODE_LINES = 6;

const CHROME_REGEX =
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const CHROME_EVAL_REGEX = /\((\S*):(\d+):(\d+)\)|\((\S*):?(\d+)?\)(,\s)?(<[^>]+>)?:(\d+)?:(\d+)?\)?/;
const CHROME_NESTED_EVAL_REGEX = /\sat\s(\S+)\s\((.*)\)\)?,?\s?(<.*>):(\d+):(\d+)\)?/;
// eslint-disable-next-line security/detect-unsafe-regex
const WINJS_REGEX = /^\s*at (?:(.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
const JAVA_SCRIPT_CORE_REGEX =
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    /^\s*(?:([^\n\r"\u2028\u2029]*".[^\n\r"\u2028\u2029]*"[^\n\r@\u2028\u2029]*(?:@[^\n\r"\u2028\u2029]*"[^\n\r@\u2028\u2029]*)*(?:[\n\r\u2028\u2029][^@]*)?)(?:\((.*?)\))?@)?@?(\S.*?):(\d+)(?::(\d+))?\s*$/;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const NODE_REGEX = /^\s*at (?:([^\\/]+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const NAVTIE_REGEX = /^((\S.*)@)?(\[.*\])$/;

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

const parseNode = (line: string): Trace | undefined => {
    const parts = NODE_REGEX.exec(line);

    debugLog(`parse node error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    return {
        args: [],
        column: parts[4] ? +parts[4] : undefined,
        file: parts[2],
        isEval: false,
        isNative: false,
        line: parts[3] ? +parts[3] : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
};

const parseJSC = (line: string): Trace | undefined => {
    const parts = JAVA_SCRIPT_CORE_REGEX.exec(line);

    debugLog(`parse jsc error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    // if a file path has a @ in the string
    // it can be that a method name was attached to the file path
    if (parts[3] && parts[3].includes("@")) {
        // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
        const subParts = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|http|resource:|\/|\\).*)$|(.*)@(.*)/.exec(parts[3] as string); // h is the first letter of the http/https protocol

        if (subParts) {
            if (subParts[1] && subParts[3]) {
                parts[1] = <string>subParts[1];
                parts[3] = <string>subParts[3];
            } else if (subParts[5]) {
                parts[1] = <string>subParts[4];
                parts[3] = <string>subParts[5];
            }
        }
    }

    return {
        args: [],
        column: parts[5] ? +parts[5] : undefined,
        file: parts[3],
        isEval: false,
        isInternal: /internal[/\\]/.test(parts[3] as string),
        isNative: false,
        line: parts[4] ? +parts[4] : undefined,
        methodName: parts[1] ?? UNKNOWN_FUNCTION,
    };
};

const parseNative = (line: string): Trace | undefined => {
    const parts = NAVTIE_REGEX.exec(line);

    debugLog(`parse native error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    return {
        args: [],
        column: undefined,
        file: parts[3],
        isEval: false,
        isNative: parts[3] ? (parts[3].startsWith("[native") as boolean) : false,
        line: undefined,
        methodName: parts[2] ?? UNKNOWN_FUNCTION,
    };
};

const parseWinjs = (line: string): Trace | undefined => {
    const parts = WINJS_REGEX.exec(line);

    debugLog(`parse winjs error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    return {
        args: [],
        column: parts[4] ? +parts[4] : undefined,
        file: parts[2],
        isEval: false,
        isNative: false,
        line: parts[3] ? +parts[3] : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
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
        isEval: true,
        isNative: false,
        line: parts[4] ? +parts[4] : undefined,
        methodName: parts[1],
    };
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseChrome = (line: string): Trace | undefined => {
    const parts = CHROME_REGEX.exec(line);

    debugLog(`parse chrome error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

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
                isEval: true,
                isNative: false,
                line: subMatch[8] ? +subMatch[8] : subMatch[2] ? +subMatch[2] : undefined,
                methodName: "eval",
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

    return {
        args: isNative ? [parts[2]] : [],
        column: parts[4] ? +parts[4] : undefined,
        evalOrigin,
        file: isNative ? undefined : parts[2],
        isEval: isEval as boolean,
        isNative: isNative as boolean,
        line: parts[3] ? +parts[3] : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
};

const parse = (error: Error, options: Partial<{ sourcemap: boolean }> = {}): Trace[] => {
    // @ts-expect-error missing stacktrace property
    const lines = (error.stacktrace ?? error.stack ?? "").split("\n");

    // eslint-disable-next-line unicorn/no-array-reduce,@typescript-eslint/no-unsafe-return
    return lines.reduce((stack: Trace[], line: string): Trace[] => {
        if (!line) {
            return stack;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const parseResult = parseChrome(line) || parseWinjs(line) || parseNode(line) || parseNative(line) || parseJSC(line);

        if (parseResult) {
            stack.push(parseResult);
        } else {
            debugLog(`parse error stack line: "${line}"`, "not parser found");
        }

        return stack;
    }, []);
};

export default parse;
