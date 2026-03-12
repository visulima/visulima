import type { ExtendedRfc5424LogLevels, Meta, Processor } from "../types";

/**
 * Head sampling configuration.
 *
 * Controls random sampling rates per log level. Each key is a log level name
 * and the value is the percentage (0-100) of logs at that level to keep.
 * Levels not listed default to 100 (keep all).
 * @example
 * ```typescript
 * const headSampling: HeadSamplingConfig = {
 *   debug: 0,      // Drop all debug logs
 *   informational: 10,  // Keep 10% of info logs
 *   warning: 50,   // Keep 50% of warning logs
 *   error: 100,    // Keep all error logs
 * };
 * ```
 */
export type HeadSamplingConfig = Partial<Record<string, number>>;

/**
 * Tail sampling condition function.
 *
 * A function that receives the log metadata and returns true if the log
 * should be force-kept regardless of head sampling. This allows keeping
 * important logs based on their content (e.g., errors, slow operations).
 * @template L - The log level type
 */
export type TailSamplingCondition<L extends string = string> = (meta: Readonly<Meta<L>>) => boolean;

/**
 * Sampling processor configuration options.
 */
export interface SamplingProcessorOptions<L extends string = string> {
    /**
     * Head sampling rates per log level.
     *
     * A map of log level to sampling percentage (0-100).
     * Levels not specified default to 100 (keep all).
     * Set to 0 to drop all logs at that level.
     */
    head?: HeadSamplingConfig;

    /**
     * Tail sampling conditions.
     *
     * An array of condition functions that can force-keep a log entry
     * even if it was dropped by head sampling. If any condition returns true,
     * the log is kept.
     */
    tail?: TailSamplingCondition<L>[];
}

/**
 * Sampling Processor.
 *
 * Inspired by evlog's production sampling strategy, this processor implements
 * both head sampling (random per-level) and tail sampling (force-keep based
 * on conditions) to control log volume in production environments.
 *
 * **Head sampling** randomly drops a percentage of logs per level. This is
 * evaluated first and provides broad volume control.
 *
 * **Tail sampling** can override head sampling to force-keep important logs
 * based on their content. For example, you might drop 90% of info logs but
 * force-keep any that contain error information or relate to slow operations.
 *
 * When a log is dropped by sampling, the processor sets a `__dropped: true`
 * boolean flag on the meta object. Reporters should check for this flag and
 * skip entries where `__dropped` is `true`.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import SamplingProcessor from "@visulima/pail/processor/sampling";
 *
 * const logger = createPail({
 *   processors: [
 *     new SamplingProcessor({
 *       head: {
 *         debug: 0,         // Drop all debug logs
 *         informational: 10, // Keep 10% of info logs
 *         warning: 50,      // Keep 50% of warnings
 *         error: 100,       // Keep all errors
 *       },
 *       tail: [
 *         // Force-keep logs with errors regardless of head sampling
 *         (meta) => meta.error !== undefined,
 *         // Force-keep logs from critical scopes
 *         (meta) => meta.scope?.includes("payment") ?? false,
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
class SamplingProcessor<L extends string = string> implements Processor<L> {
    readonly #headRates: HeadSamplingConfig;

    readonly #tailConditions: TailSamplingCondition<L>[];

    /**
     * Creates a new SamplingProcessor instance.
     * @param options Sampling configuration options
     */
    public constructor(options: SamplingProcessorOptions<L> = {}) {
        this.#headRates = options.head ?? {};
        this.#tailConditions = options.tail ?? [];
    }

    /**
     * Processes log metadata to apply sampling rules.
     *
     * First evaluates head sampling (random per-level), then checks tail
     * sampling conditions. If a log is dropped, the meta is marked with
     * `__dropped: true` so reporters can skip it.
     * @param meta The log metadata to process
     * @returns The processed metadata, potentially marked as dropped
     */
    public process(meta: Meta<L>): Meta<L> {
        const level = meta.type.level as string;

        // Check head sampling
        if (this.#shouldDrop(level)) {
            // Check tail sampling - can override head sampling
            if (this.#shouldForceKeep(meta)) {
                return meta;
            }

            // Mark as dropped
            // eslint-disable-next-line no-param-reassign
            (meta as Meta<L> & { __dropped?: boolean }).__dropped = true;

            return meta;
        }

        return meta;
    }

    /**
     * Evaluates head sampling for the given log level.
     * @returns true if the log should be dropped
     */
    #shouldDrop(level: string): boolean {
        const rate = this.#headRates[level];

        // If no rate configured for this level, keep all
        if (rate === undefined) {
            return false;
        }

        // 0 means drop all, 100 means keep all
        if (rate <= 0) {
            return true;
        }

        if (rate >= 100) {
            return false;
        }

        return Math.random() * 100 >= rate;
    }

    /**
     * Evaluates tail sampling conditions.
     * @returns true if any condition forces keeping the log
     */
    #shouldForceKeep(meta: Readonly<Meta<L>>): boolean {
        for (const condition of this.#tailConditions) {
            if (condition(meta)) {
                return true;
            }
        }

        return false;
    }
}

export default SamplingProcessor;
