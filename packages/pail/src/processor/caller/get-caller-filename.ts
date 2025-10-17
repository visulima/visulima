/** Type alias for Node.js CallSite */
type CallSite = NodeJS.CallSite;

/**
 * Extended CallSite information with file details.
 */
type CallSiteWithFileName = {
    /** Column number in the source file (nullable) */
    columnNumber: number | null;
    /** File name/path */
    fileName: string | undefined;
    /** Line number in the source file (nullable) */
    lineNumber: number | null;
};

/**
 * Gets the file location information of the caller.
 *
 * Uses Node.js stack trace API to analyze the call stack and determine
 * the file, line, and column where this function was called from.
 * Filters out internal pail files and native code.
 * @returns Object containing file location information
 * @example
 * ```typescript
 * const location = getCallerFilename();
 * console.log(location);
 * // { fileName: "/path/to/file.js", lineNumber: 42, columnNumber: 10 }
 * ```
 */
const getCallerFilename = (): {
    /** Column number where the call originated */
    columnNumber?: number;
    /** File name/path where the call originated */
    fileName: string | undefined;
    /** Line number where the call originated */
    lineNumber?: number;
} => {
    const errorStack = Error.prepareStackTrace;

    try {
        let result: CallSite[] = [];

        Error.prepareStackTrace = (_error, stack) => {
            const callSitesWithoutCurrent = stack.slice(1);

            result = callSitesWithoutCurrent;

            return callSitesWithoutCurrent;
        };

        // eslint-disable-next-line unicorn/error-message
        new Error().stack;

        // eslint-disable-next-line unicorn/no-array-reduce
        const callers = result.reduce<CallSiteWithFileName[]>((accumulator, x) => {
            if (x.isNative() || x.getFileName()?.includes("pail/dist")) {
                return accumulator;
            }

            accumulator.push({
                columnNumber: x.getColumnNumber(),
                fileName: x.getFileName(),
                lineNumber: x.getLineNumber(),
            });

            return accumulator;
        }, []);

        const firstExternalFilePath = callers[0];

        if (firstExternalFilePath) {
            return {
                columnNumber: firstExternalFilePath.columnNumber ?? undefined,
                fileName: firstExternalFilePath.fileName,
                lineNumber: firstExternalFilePath.lineNumber ?? undefined,
            };
        }

        return {
            fileName: "anonymous",
            lineNumber: undefined,
        };
    } finally {
        Error.prepareStackTrace = errorStack;
    }
};

export default getCallerFilename;
