import hardRejection from "hard-rejection";

import type { Logger as ILogger } from "../@types";

const registerExceptionHandler = (logger_: ILogger): void => {
    // we want to see real exceptions with backtraces and stuff
    process.on("uncaughtException", (error: Partial<Error> | null | undefined) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger_.error(`Uncaught exception: ${error}`);

        if (error?.stack) {
            logger_.error(error.stack);
        }

        process.exit(1);
    });

    process.on("unhandledRejection", (error: Partial<Error> | null | undefined) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger_.error(`Promise rejection: ${error}`);

        if (error?.stack) {
            logger_.error(error.stack);
        }

        process.exit(1);
    });

    hardRejection((stack?: string) => {
        if (stack) {
            logger_.error(stack);
        }
    });
};

export default registerExceptionHandler;
