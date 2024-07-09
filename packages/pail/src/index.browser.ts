import type { PailBrowserType } from "./pail.browser";
import { PailBrowser } from "./pail.browser";
import MessageFormatterProcessor from "./processor/message-formatter-processor";
import JsonReporter from "./reporter/json/json.browser";
import type { ConstructorOptions } from "./types";

export const createPail = <T extends string = string, L extends string = string>(options?: ConstructorOptions<T, L>): PailBrowserType<T, L> =>
    new PailBrowser<T, L>({
        processors: [new MessageFormatterProcessor<L>()],
        reporters: [new JsonReporter<L>()],
        ...options,
    });

export const pail = createPail();

export type { PailBrowserType as Pail } from "./pail.browser";
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
