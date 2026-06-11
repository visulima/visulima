import duration from "./duration";
import parseDuration from "./parse-duration";
import type { DurationOptions, ParseDurationOptions } from "./types";

/**
 * A preconfigured humanizer instance, created via {@link humanizer}.
 *
 * Both methods accept a per-call options object that is shallow-merged over the
 * options the instance was created with, so you can override individual settings
 * without re-spreading the whole configuration.
 */
interface Humanizer {
    /**
     * Format a millisecond value into a human-readable duration string using the
     * instance's preconfigured options (e.g. language, units).
     * @param milliseconds The duration in milliseconds.
     * @param overrides Optional per-call options merged over the instance defaults.
     */
    duration: (milliseconds: number, overrides?: DurationOptions) => string;

    /**
     * Parse a human-readable duration string into milliseconds using the
     * instance's preconfigured options (e.g. language, defaultUnit).
     * @param value The string to parse.
     * @param overrides Optional per-call options merged over the instance defaults.
     */
    parseDuration: (value: string, overrides?: ParseDurationOptions) => number | undefined;
}

/**
 * Create a preconfigured humanizer instance.
 *
 * This is the ergonomic equivalent of humanize-duration's `humanizer({...})`
 * factory: instead of passing the same `language`/`units`/... options to every
 * `duration()` call, configure them once.
 * @example
 * ```ts
 * import { humanizer } from "@visulima/humanizer";
 * import { durationLanguage as es } from "@visulima/humanizer/language/es";
 *
 * const h = humanizer({ language: es, units: ["h", "m"] });
 *
 * h.duration(3_600_000); // "1 hora"
 * h.parseDuration("2 horas"); // 7200000
 * ```
 * @param options Default options applied to every `duration`/`parseDuration` call.
 * @returns A {@link Humanizer} instance.
 */
const humanizer = (options?: DurationOptions): Humanizer => {
    const defaults = options ?? {};

    return {
        duration: (milliseconds: number, overrides?: DurationOptions): string => duration(milliseconds, { ...defaults, ...overrides }),
        parseDuration: (value: string, overrides?: ParseDurationOptions): number | undefined => {
            const merged: ParseDurationOptions = {};

            if (defaults.language !== undefined) {
                merged.language = defaults.language;
            }

            return parseDuration(value, { ...merged, ...overrides });
        },
    };
};

export type { Humanizer };

export default humanizer;
