const debugLog = (message: string, ...arguments_: unknown[]): void => {
    if (process.env["DEBUG"] && String(process.env["DEBUG"]) === "true") {
        // eslint-disable-next-line no-console
        console.debug(`error:parse-stacktrace: ${message}`, ...arguments_);
    }
};

export default debugLog;
