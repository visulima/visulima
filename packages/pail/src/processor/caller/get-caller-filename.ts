type CallSite = NodeJS.CallSite;

type CallSiteWithFileName = { columnNumber: number | null; fileName: string | undefined; lineNumber: number | null };

const getCallerFilename = (): {
    columnNumber?: number;
    fileName: string | undefined;
    lineNumber: number | undefined;
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
