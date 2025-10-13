import type { Pail } from "@visulima/pail/server";

const registerExceptionHandler = (logger: Pail): void => {
    // we want to see real exceptions with backtraces and stuff
    process.on("uncaughtException", (error: Partial<Error> | null | undefined) => {
        logger.error(`Uncaught exception: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        process.exit(1);
    });

    process.on("unhandledRejection", (error: Partial<Error> | null | undefined) => {
        logger.error(`Promise rejection: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        process.exit(1);
    });
};

export default registerExceptionHandler;
