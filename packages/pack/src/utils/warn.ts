import type { BuildContext } from "../types";
import logger from "../logger";

export function warn(ctx: BuildContext, message: string) {
    if (ctx.warnings.has(message)) {
        return;
    }

    logger.debug({
        message,
        prefix: "warn",
    });

    ctx.warnings.add(message);
}
