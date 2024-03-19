import logger from "../logger";
import type { BuildContext } from "../types";

const warn = (context: BuildContext, message: string): void => {
    if (context.warnings.has(message)) {
        return;
    }


    logger.debug({
        message,
        prefix: "warn",
    });

    context.warnings.add(message);
};

export default warn;
