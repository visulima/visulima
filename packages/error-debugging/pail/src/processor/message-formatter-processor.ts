import type { format, FormatterFunction } from "@visulima/fmt";
// eslint-disable-next-line import/no-extraneous-dependencies
import { build } from "@visulima/fmt";

import type { Meta, StringifyAwareProcessor } from "../types";

/**
 * Message Formatter Processor.
 *
 * A processor that formats log messages using the {@link https://visulima.com/packages/fmt/|@visulima/fmt} library.
 * Supports custom formatters, string interpolation, and complex object formatting.
 * Processes both the main message and contextual data.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import MessageFormatterProcessor from "@visulima/pail/processor/message-formatter";
 *
 * const logger = createPail({
 *   processors: [new MessageFormatterProcessor({
 *     formatters: {
 *       user: (value) => `[USER:${value.id}]`
 *     }
 *   })]
 * });
 *
 * logger.info("User {user} logged in", { user: { id: 123 } });
 * // Output: "User [USER:123] logged in"
 * ```
 */
class MessageFormatterProcessor<L extends string = string> implements StringifyAwareProcessor<L> {
    /** Custom stringify function for object serialization */
    #stringify: typeof JSON.stringify | undefined;

    /** Custom formatters for message interpolation */
    readonly #formatters: Record<string, FormatterFunction> | undefined;

    /**
     * Creates a new MessageFormatterProcessor instance.
     * @param options Configuration options
     * @param options.formatters Custom formatters for message interpolation
     */
    public constructor(options: { formatters?: Record<string, FormatterFunction> } = {}) {
        this.#formatters = options.formatters;
    }

    /**
     * Sets the stringify function for object serialization.
     * @param function_ The stringify function to use for serializing objects
     */
    public setStringify(function_: typeof JSON.stringify): void {
        this.#stringify = function_;
    }

    /**
     * Processes log metadata to format messages.
     *
     * Applies string interpolation and custom formatters to the message
     * and contextual data in the log metadata.
     * @param meta The log metadata to process
     * @returns The processed metadata with formatted messages
     */
    public process(meta: Meta<L>): Meta<L> {
        const formatter = build({
            formatters: this.#formatters,
            stringify: (value: unknown) => {
                if (!this.#stringify) {
                    return JSON.stringify(value);
                }

                return this.#stringify(value);
            },
        });

        if (meta.message !== undefined) {
            // eslint-disable-next-line no-param-reassign
            meta.message = this.#format(formatter, meta.message, meta.context ?? []) as typeof meta.message;
        }

        return meta;
    }

    /**
     * Recursively formats data using the formatter.
     *
     * Applies string interpolation and formatting to strings, arrays, and objects.
     * @param formatter The formatter function to use
     * @param data The data to format (string, array, or object)
     * @param arguments_ Additional arguments for formatting
     * @returns The formatted data
     * @private
     */
    #format(formatter: typeof format, data: unknown, arguments_: unknown[] = []): unknown {
        if (typeof data === "string") {
            return formatter(data, arguments_);
        }

        if (typeof data === "object" && data !== null) {
            const record = data as Record<string, unknown>;
            const keys = Object.keys(record);

            for (let i = 0; i < keys.length; i += 1) {
                const index = keys[i];
                const value: unknown = record[index];

                if (typeof value === "string" || Array.isArray(value) || typeof value === "object") {
                    record[index] = this.#format(formatter, value, arguments_);
                }
            }
        }

        return data;
    }
}

export default MessageFormatterProcessor;
