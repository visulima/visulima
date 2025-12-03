const captureRawStackTrace = (): string | undefined => {
    if (!Error.captureStackTrace) {
        return undefined;
    }

    // eslint-disable-next-line unicorn/error-message
    const stack = new Error();

    Error.captureStackTrace(stack);

    return stack.stack;
};

export default captureRawStackTrace;
