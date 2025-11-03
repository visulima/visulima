import type { Pail, Processor } from "@visulima/pail";
import CallerProcessor from "@visulima/pail/processor/caller";
import MessageFormatterProcessor from "@visulima/pail/processor/message-formatter";
import { createPail } from "@visulima/pail/server";

import { VERBOSITY_DEBUG, VERBOSITY_QUIET } from "../constants";
import type { VERBOSITY_LEVEL } from "../types/cli";

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

    if (process.env.CEREBRO_OUTPUT_LEVEL === String(128) || process.env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
        processors.push(new CallerProcessor());
    }

    const logger = createPail({
        logLevel: process.env.CEREBRO_OUTPUT_LEVEL ? cerebroLevelToPailLevel[process.env.CEREBRO_OUTPUT_LEVEL as unknown as VERBOSITY_LEVEL] : "informational",
        processors,
    });

    if (process.env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_QUIET)) {
        logger.disable();
    }

    return logger;
};

export default createPailLogger;
