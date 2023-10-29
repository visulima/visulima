import hardRejection from "hard-rejection";

import type { Logger as ILogger } from "../@types";

const registerExceptionHandler = (logger_: ILogger): void => {
    // we want to see real exceptions with backtraces and stuff
    process.on("uncaughtException", (error: Partial<Error> | null | undefined) => {
        logger_.error(`Uncaught exception: ${error}`);

        if (error?.stack) {
            logger_.error(error.stack);
        }

        process.exit(1);
    });

    process.on("unhandledRejection", (error: Partial<Error> | null | undefined) => {
        logger_.error(`Promise rejection: ${error}`);

        if (error?.stack) {
            logger_.error(error.stack);
        }

        process.exit(1);
    });

    hardRejection(logger_.error);
};

export default registerExceptionHandler;
