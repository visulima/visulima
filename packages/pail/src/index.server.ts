import { env, stderr, stdout } from "node:process";

import type { PailServerType } from "./pail.server";
import { PailServer } from "./pail.server";
import ErrorProcessor from "./processor/error/error-processor";
import MessageFormatterProcessor from "./processor/message-formatter-processor";
import PrettyReporter from "./reporter/pretty/pretty.server";
import type { ConstructorOptions, ExtendedRfc5424LogLevels } from "./types";

// eslint-disable-next-line @typescript-eslint/naming-convention
const _getDefaultLogLevel = (): ExtendedRfc5424LogLevels => {
    if (env.NODE_ENV === "debug" || env.DEBUG !== undefined) {
        return "debug";
    }

    if (env.NODE_ENV === "test") {
        return "warning";
    }

    return "informational";
};

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>): PailServerType<T, L> => {
    let logLevel: ExtendedRfc5424LogLevels = _getDefaultLogLevel();

    if (env.PAIL_LOG_LEVEL !== undefined) {
        logLevel = env.PAIL_LOG_LEVEL as ExtendedRfc5424LogLevels;
    }

    return new PailServer<T, L>({
        logLevel,
        processors: [new MessageFormatterProcessor<L>(), new ErrorProcessor<L>()],
        reporters: [new PrettyReporter()],
        stderr,
        stdout,
        ...options,
    });
}

export const pail = createPail();

export type { PailServerType as Pail } from "./pail.server";
export type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    ExtendedRfc5424LogLevels,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Processor,
    Reporter,
    StreamAwareReporter,
} from "./shared";
