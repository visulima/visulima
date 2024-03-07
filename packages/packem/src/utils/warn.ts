import logger from "../logger";
import type { BuildContext } from "../types";

export const warn = (context: BuildContext, message: string): void => {
    if (context.warnings.has(message)) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    logger.debug({
        message,
        prefix: "warn",
    });

    context.warnings.add(message);
};
