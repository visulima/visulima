import { basename } from "node:path";

type CallSite = NodeJS.CallSite;

type CallSiteWithFileName = { fileName: string | undefined; lineNumber: number | null };

const getCallerFilename = (): string => {
    const eStack = Error.prepareStackTrace;

    try {
        Error.prepareStackTrace = (_error, stack) => stack;

        const stack = new Error().stack as unknown as CallSite[];

        const callers = stack.map(
            (x) =>
                ({
                    fileName: x.getFileName(),
                    lineNumber: x.getLineNumber(),
                }) as CallSiteWithFileName,
        );

        const firstExternalFilePath = callers.find((x) => x.fileName !== (callers[0] as CallSiteWithFileName).fileName);

        if (firstExternalFilePath) {
            return `${basename(firstExternalFilePath.fileName as string)} - Line: ${firstExternalFilePath.lineNumber}`;
        }

        return "anonymous";
    } finally {
        Error.prepareStackTrace = eStack;
    }
};

export default getCallerFilename;
