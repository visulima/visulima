// @visulima/pail is an optional peer dependency

// @ts-ignore - Optional peer dependency, types may not be available
import type { Pail, Processor } from "@visulima/pail";
// @ts-ignore - Optional peer dependency, types may not be available
import CallerProcessor from "@visulima/pail/processor/caller";
// @ts-ignore - Optional peer dependency, types may not be available
import MessageFormatterProcessor from "@visulima/pail/processor/message-formatter";
// @ts-ignore - Optional peer dependency, types may not be available
import { createPail } from "@visulima/pail/server";

import { VERBOSITY_DEBUG, VERBOSITY_QUIET } from "../constants";
import type { VERBOSITY_LEVEL } from "../types/cli";
import { getEnv } from "../util/general/runtime-process";

/**
 * Create a Pail logger.
 */
const createPailLogger = async (): Promise<Pail> => {
    const cerebroLevelToPailLevel: Record<Partial<VERBOSITY_LEVEL>, string> = {
        16: "informational",
        32: "informational",
        64: "trace",
        128: "debug",
        256: "debug",
    };

    const processors: Processor<string>[] = [new MessageFormatterProcessor()];
    const env = getEnv();
    const outputLevel = env.CEREBRO_OUTPUT_LEVEL;

    if (outputLevel === String(128) || outputLevel === String(VERBOSITY_DEBUG)) {
        processors.push(new CallerProcessor());
    }

    const logger = createPail({
        logLevel: outputLevel ? cerebroLevelToPailLevel[outputLevel as unknown as VERBOSITY_LEVEL] : "informational",
        processors,
    });

    if (outputLevel === String(VERBOSITY_QUIET)) {
        logger.disable();
    }

    return logger;
};

export default createPailLogger;
