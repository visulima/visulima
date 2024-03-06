import type { Pail } from "@visulima/pail/server";
import hardRejection from "hard-rejection";

const registerExceptionHandler = (logger: Pail<never, string>): void => {
    // we want to see real exceptions with backtraces and stuff
    process.on("uncaughtException", (error: Partial<Error> | null | undefined) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger.error(`Uncaught exception: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        process.exit(1);
    });

    process.on("unhandledRejection", (error: Partial<Error> | null | undefined) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger.error(`Promise rejection: ${error}`);

        if (error?.stack) {
            logger.error(error.stack);
        }

        process.exit(1);
    });

    hardRejection((stack?: string) => {
        if (stack) {
            logger.error(stack);
        }
    });
};

export default registerExceptionHandler;
