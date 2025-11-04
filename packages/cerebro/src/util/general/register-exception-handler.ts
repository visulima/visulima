import type { ProcessEventHandler } from "./runtime-process";
import { exitProcess, onProcessEvent } from "./runtime-process";

/**
 * Registers global exception handlers for uncaught exceptions and unhandled promise rejections.
 * Logs errors using the provided logger and exits the process with code 1.
 * @template T - Logger type that extends Console interface
 * @param logger Console-like logger instance for error reporting
 * @returns Cleanup function to remove event listeners
 */
const registerExceptionHandler = <T extends Console = Console>(logger: T): () => void => {
    // we want to see real exceptions with backtraces and stuff
    const uncaughtExceptionHandler = (error: Error) => {
        logger.error(`Uncaught exception: ${error.message || error}`);

        if (error.stack) {
            logger.error(error.stack);
        }

        exitProcess(1);
    };

    const unhandledRejectionHandler = (reason: unknown, _promise?: Promise<unknown>) => {
        if (reason instanceof Error) {
            logger.error(`Promise rejection: ${reason.message || reason}`);

            if (reason.stack) {
                logger.error(reason.stack);
            }
        } else {
            let reasonString: string;

            if (typeof reason === "string") {
                reasonString = reason;
            } else {
                try {
                    reasonString = JSON.stringify(reason);
                } catch {
                    reasonString = String(reason);
                }
            }

            logger.error(`Promise rejection: ${reasonString}`);
        }

        exitProcess(1);
    };

    const cleanupUncaughtException = onProcessEvent("uncaughtException", uncaughtExceptionHandler as ProcessEventHandler);
    const cleanupUnhandledRejection = onProcessEvent("unhandledRejection", unhandledRejectionHandler as ProcessEventHandler);

    // Return cleanup function
    return () => {
        cleanupUncaughtException();
        cleanupUnhandledRejection();
    };
};

export default registerExceptionHandler;
