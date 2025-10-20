import type { format, FormatterFunction, Options } from "@visulima/fmt";
// eslint-disable-next-line import/no-extraneous-dependencies
import { build } from "@visulima/fmt";
import type { stringify } from "safe-stable-stringify";

import type { Meta, StringifyAwareProcessor } from "../types";

/**
 * Message Formatter Processor.
 *
 * A processor that formats log messages using the {@link https://www.visulima.com/docs/package/fmt|@visulima/fmt} library.
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
    #stringify: typeof stringify | undefined;

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
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
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
                const stringified = (this.#stringify as typeof stringify)(value);

                if (stringified === undefined) {
                    // eslint-disable-next-line no-console
                    console.warn(`Unable to stringify value of type ${typeof value}`, value);

                    return "undefined";
                }

                return stringified;
            },
        } as Options);

        if (meta.message !== undefined) {
            // eslint-disable-next-line no-param-reassign
            meta.message = this.#format(formatter, meta.message, meta.context ?? []);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    #format(formatter: typeof format, data: any, arguments_: unknown[] = []): any {
        if (typeof data === "string") {
            return formatter(data as string, arguments_);
        }

        if (typeof data === "object" && data !== null) {
            // eslint-disable-next-line guard-for-in,no-restricted-syntax
            for (const index in data as Record<string, unknown> | [string, unknown[]]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (data as any)[index];

                if (typeof value === "string" || Array.isArray(value) || typeof value === "object") {
                    // eslint-disable-next-line no-param-reassign
                    data[index] = this.#format(formatter, value, arguments_);
                }
            }
        }

        return data;
    }
}

export default MessageFormatterProcessor;
