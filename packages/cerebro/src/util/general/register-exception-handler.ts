/**
 * Registers global exception handlers for uncaught exceptions and unhandled promise rejections.
 * Returns a cleanup function to remove the handlers.
 */
const registerExceptionHandler = <T extends Console = Console>(logger: T): () => void => {
    // Define handler functions so we can remove them later
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

    // Register the handlers
    process.on("uncaughtException", uncaughtExceptionHandler);
    process.on("unhandledRejection", unhandledRejectionHandler);

    // Return cleanup function
    return () => {
        process.off("uncaughtException", uncaughtExceptionHandler);
        process.off("unhandledRejection", unhandledRejectionHandler);
    };
};

export default registerExceptionHandler;
