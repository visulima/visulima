/**
 * Registers global exception handlers for uncaught exceptions and unhandled promise rejections.
 * Logs errors using the provided logger and exits the process with code 1.
 * @template T - Logger type that extends Console interface
 * @param logger Console-like logger instance for error reporting
 * @returns Cleanup function to remove event listeners
 */
const registerExceptionHandler = <T extends Console = Console>(logger: T): () => void => {
    // we want to see real exceptions with backtraces and stuff
    const uncaughtExceptionHandler = (error: Partial<Error> | null | undefined) => {
        logger.error(`Uncaught exception: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    };

    const unhandledRejectionHandler = (error: Partial<Error> | null | undefined) => {
        logger.error(`Promise rejection: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    };

    process.on("uncaughtException", uncaughtExceptionHandler);
    process.on("unhandledRejection", unhandledRejectionHandler);

    // Return cleanup function
    return () => {
        process.removeListener("uncaughtException", uncaughtExceptionHandler);
        process.removeListener("unhandledRejection", unhandledRejectionHandler);
    };
};

export default registerExceptionHandler;
