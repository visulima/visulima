const captureRawStackTrace = (): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!Error.captureStackTrace) {
        return undefined;
    }

    // eslint-disable-next-line unicorn/error-message
    const stack = new Error();

    Error.captureStackTrace(stack);

    return stack.stack;
};

export default captureRawStackTrace;
