import type { PailBrowserType } from "./pail.browser";
import { PailBrowser } from "./pail.browser";
import { ErrorProcessor } from "./processor/error/error-processor";
import { MessageFormatterProcessor } from "./processor/message-formatter-processor";
import { JsonReporter } from "./reporter/json/json.browser";
import type { ConstructorOptions, Processor } from "./types";

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>): PailBrowserType<T, L> =>
    new PailBrowser<T, L>({
        processors: options?.processors ?? [new MessageFormatterProcessor<L>(), ...(typeof window === "undefined" ? [new ErrorProcessor()] as Processor<L>[] : [])],

        reporters: options?.reporters ?? [new JsonReporter<L>()],
        ...options,
    });

export const pail = createPail();

export type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Processor,
    Reporter,
    Rfc5424LogLevels,
    Serializer,
    StreamAwareReporter,
} from "./shared";
