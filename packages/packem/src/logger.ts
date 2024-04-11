import { env } from "node:process";

import { createPail } from "@visulima/pail";
import { CallerProcessor } from "@visulima/pail/processor";

const logger = createPail({
    processors: env.DEBUG === undefined ? [] : [new CallerProcessor()],
    scope: "packem"
});

logger.wrapAll();

export default logger;
