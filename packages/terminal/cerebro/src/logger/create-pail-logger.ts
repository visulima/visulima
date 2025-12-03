// @ts-ignore - Optional peer dependency, types may not be available
import type { ConstructorOptions, PailServerType, Processor } from "@visulima/pail";
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
 * @param options Optional configuration options for the logger
 * @returns A configured Pail logger instance
 */
const createPailLogger = (options?: Partial<ConstructorOptions<string, string>>): PailServerType<string, string> => {
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

    // Use environment-based logLevel unless explicitly provided in options
    const envLogLevel = (outputLevel && cerebroLevelToPailLevel[outputLevel as unknown as VERBOSITY_LEVEL]) || "informational";

    const loggerOptions = {
        ...options,
        logLevel: options?.logLevel ?? envLogLevel,
        processors: options?.processors ? [...processors, ...options.processors] : processors,
    };

    const logger = createPail(loggerOptions as Parameters<typeof createPail>[0]);

    if (outputLevel === String(VERBOSITY_QUIET)) {
        logger.disable();
    }

    return logger;
};

export default createPailLogger;
