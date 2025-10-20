import type { RedactOptions, Rules } from "@visulima/redact";
import { redact, standardRules } from "@visulima/redact";

import type { Meta, Processor } from "../types";

/**
 * Redact Processor.
 *
 * A processor that redacts sensitive information from log messages and metadata.
 * Uses the {@link https://www.visulima.com/docs/package/redact|@visulima/redact} library to identify and mask sensitive data like
 * passwords, API keys, credit card numbers, and other PII.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import RedactProcessor from "@visulima/pail/processor/redact";
 *
 * const logger = createPail({
 *   processors: [new RedactProcessor()]
 * });
 *
 * logger.info("User login", {
 *   username: "john",
 *   password: "secret123",  // Will be redacted
 *   apiKey: "sk-123456"    // Will be redacted
 * });
 * ```
 */
class RedactProcessor<L extends string = string> implements Processor<L> {
    /** The redact function configured with custom rules and options */
    readonly #redact: <T>(input: T) => T;

    /**
     * Creates a new RedactProcessor instance.
     * @param rules Custom redaction rules (uses standardRules if not provided)
     * @param options Additional redaction options
     */
    public constructor(rules?: Rules, options?: RedactOptions) {
        this.#redact = <T>(input: T) => redact(input, rules || standardRules, options);
    }

    /**
     * Processes log metadata to redact sensitive information.
     *
     * Applies redaction rules to the message, context, and error properties
     * in the log metadata to prevent sensitive data from being logged.
     * @param meta The log metadata to process
     * @returns The processed metadata with sensitive data redacted
     */
    public process(meta: Meta<L>): Meta<L> {
        // eslint-disable-next-line no-param-reassign
        meta.message = this.#redact<typeof meta.message>(meta.message);
        // eslint-disable-next-line no-param-reassign
        meta.context = this.#redact<typeof meta.context>(meta.context);
        // eslint-disable-next-line no-param-reassign
        meta.error = this.#redact<typeof meta.error>(meta.error);

        return meta;
    }
}

export default RedactProcessor;
