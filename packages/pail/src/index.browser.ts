import Pail from "./pail";
import JsonReporter from "./reporter/json/json.browser";
import type { ConstructorOptions } from "./types";

export * from "./shared";

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>) => new Pail<T, L>({
        reporters: options?.reporters || [new JsonReporter<L>()],
        ...options,
    });

export const pail = createPail();
