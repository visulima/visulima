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
const CHROME_EVAL_REGEX = /\((\S*):(\d+):(\d+)\)|\((\S*)\)/;
// eslint-disable-next-line security/detect-unsafe-regex
const WINJS_REGEX = /^\s*at (?:(.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const GECKO_REGEX = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const GECKO_EVAL_REGEX = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const JAVA_SCRIPT_CORE_REGEX =
    // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
    /^\s*(?:([^\n\r"\u2028\u2029]*".[^\n\r"\u2028\u2029]*"[^\n\r@\u2028\u2029]*(?:@[^\n\r"\u2028\u2029]*"[^\n\r@\u2028\u2029]*)*(?:[\n\r\u2028\u2029][^@]*)?)(?:\((.*?)\))?@)?@?(\S.*?):(\d+)(?::(\d+))?\s*$/;
// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-super-linear-backtracking
const NODE_REGEX = /^\s*at (?:([^\\/]+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;

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
        line: +parts[3],
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

    return {
        args: [],
        column: parts[5] ? +parts[5] : undefined,
        file: parts[3],
        line: +parts[4],
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
};

const parseGecko = (line: string): Trace | undefined => {
    const parts = GECKO_REGEX.exec(line);

    debugLog(`parse gecko error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    const isEval = parts[3]?.includes(" > eval");

    const subMatch = parts[3] ? GECKO_EVAL_REGEX.exec(parts[3]) : null;

    if (isEval && subMatch !== null) {
        // throw out eval line/column and use top-most line number
        parts[3] = <string>subMatch[1];
        parts[4] = <string>subMatch[2];
        parts[5] = undefined; // no column when eval
    }

    return {
        args: parts[2] ? parts[2].split(",") : [],
        column: parts[5] ? +parts[5] : undefined,
        file: parts[3],
        line: parts[4] ? +parts[4] : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
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
        line: +parts[3],
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
};

const parseChrome = (line: string): Trace | undefined => {
    const parts = CHROME_REGEX.exec(line);

    debugLog(`parse chrome error stack line: "${line}"`, parts === null ? "not found" : `found: ${JSON.stringify(parts)}`);

    if (!parts) {
        return undefined;
    }

    const isNative = parts[2] && parts[2].startsWith("native"); // start of line
    const isEval = parts[2] && parts[2].startsWith("eval"); // start of line

    const subMatch = parts[2] ? CHROME_EVAL_REGEX.exec(parts[2]) : null;

    if (isEval && subMatch !== null) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = subMatch[1] ?? (subMatch[4] as string); // url
        parts[3] = <string>subMatch[2]; // line
        parts[4] = <string>subMatch[3]; // column
    }

    return {
        args: isNative ? [parts[2]] : [],
        column: parts[4] ? +parts[4] : undefined,
        file: isNative ? undefined : parts[2],
        line: parts[3] ? +parts[3] : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        methodName: parts[1] || UNKNOWN_FUNCTION,
    };
};

const parse = (error: Error): Trace[] => {
    // @ts-expect-error missing stacktrace property
    const lines = (error.stacktrace ?? error.stack ?? "").split("\n");

    // eslint-disable-next-line unicorn/no-array-reduce,@typescript-eslint/no-unsafe-return
    return lines.reduce((stack: Trace[], line: string): Trace[] => {
        if (!line) {
            return stack;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const parseResult = parseChrome(line) || parseWinjs(line) || parseGecko(line) || parseNode(line) || parseJSC(line);

        if (parseResult) {
            stack.push(parseResult);
        } else {
            debugLog(`parse error stack line: "${line}"`, "not parser found");
        }

        return stack;
    }, []);
};

export default parse;
