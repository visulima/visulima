type CallSite = NodeJS.CallSite;

type CallSiteWithFileName = { fileName: string | undefined; lineNumber: number | null };

const getCallerFilename = (): {
    fileName: string | undefined;
    lineNumber: number | undefined;
} => {
    const eStack = Error.prepareStackTrace;

    try {
        let result: CallSite[] = [];

        Error.prepareStackTrace = (_error, stack) => {
            const callSitesWithoutCurrent = stack.slice(1);

            result = callSitesWithoutCurrent;

            return callSitesWithoutCurrent;
        };

        new Error().stack;

        const callers = result.map(
            (x) =>
                ({
                    fileName: x.getFileName(),
                    lineNumber: x.getLineNumber(),
                }) as CallSiteWithFileName,
        );

        const firstExternalFilePath = callers.at(-2);

        if (firstExternalFilePath) {
            return {
                fileName: firstExternalFilePath.fileName,
                lineNumber: firstExternalFilePath.lineNumber ?? undefined,
            };
        }

        return {
            fileName: "anonymous",
            lineNumber: undefined,
        };
    } finally {
        Error.prepareStackTrace = eStack;
    }
};

export default getCallerFilename;
