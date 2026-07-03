const captureRawStackTrace = (): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- captureStackTrace is V8-specific and may not exist in all runtimes (e.g. browsers)
    if (!Error.captureStackTrace) {
        return undefined;
    }

    // eslint-disable-next-line unicorn/error-message
    const stack = new Error();

    Error.captureStackTrace(stack);

    return stack.stack;
};

export default captureRawStackTrace;
