import type { PailBrowserType } from "./pail.browser";
import { PailBrowser } from "./pail.browser";
import { ErrorProcessor } from "./processor/error/error-processor";
import { MessageFormatterProcessor } from "./processor/message-formatter-processor";
import { JsonReporter } from "./reporter/json/json.browser";
import type { ConstructorOptions } from "./types";

export * from "./shared";

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>): PailBrowserType<T, L> =>
    new PailBrowser<T, L>({
        processors: options?.processors ?? [new MessageFormatterProcessor<L>(), new ErrorProcessor<L>()],
        reporters: options?.reporters ?? [new JsonReporter<L>()],
        ...options,
    });

export const pail = createPail();
