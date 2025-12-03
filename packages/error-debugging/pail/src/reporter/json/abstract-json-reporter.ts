// eslint-disable-next-line import/no-extraneous-dependencies
import { serializeError } from "@visulima/error/error";
import type { stringify } from "safe-stable-stringify";
import type { LiteralUnion } from "type-fest";

import { EMPTY_SYMBOL } from "../../constants";
import type { ExtendedRfc5424LogLevels, ReadonlyMeta, StringifyAwareReporter } from "../../types";

/**
 * Options for configuring JSON reporters.
 */
export type AbstractJsonReporterOptions = {
    /** Error serialization options */
    error: Partial<{
        /** Properties to exclude from error serialization */
        exclude?: string[];
        /** Maximum depth for error object serialization */
        maxDepth?: number;
        /** Whether to use toJSON methods during serialization */
        useToJSON?: boolean;
    }>;
};

/**
 * Abstract JSON Reporter.
 *
 * Base class for JSON-based reporters that provides common functionality
 * for serializing log metadata to JSON format. Handles error serialization,
 * context processing, and provides a template method for actual output.
 * @template L - The log level type
 * @example
 * ```typescript
 * class CustomJsonReporter extends AbstractJsonReporter {
 *   protected _log(message: string): void {
 *     console.log(message);
 *   }
 * }
 * ```
 */
export abstract class AbstractJsonReporter<L extends string = string> implements StringifyAwareReporter<L> {
    /** Custom stringify function for object serialization */
    protected stringify: typeof stringify | undefined;

    /** Error serialization options */
    protected errorOptions: AbstractJsonReporterOptions["error"];

    /**
     * Creates a new AbstractJsonReporter instance.
     * @param options Configuration options for JSON formatting and error handling
     */
    public constructor(options: Partial<AbstractJsonReporterOptions> = {}) {
        this.errorOptions = options.error ?? {};
    }

    /**
     * Sets a custom stringify function for object serialization.
     * @param function_ The stringify function to use for serialization
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this.stringify = function_;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public log(meta: ReadonlyMeta<L>): void {
        // @ts-ignore -- tsup can find the type
        const { context, error, file, message, type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        if (file) {
            // This is a hack to make the file property a string
            (rest as unknown as Omit<ReadonlyMeta<L>, "file"> & { file: string }).file = `${file.name}:${file.line}${file.column ? `:${file.column}` : ""}`;
        }

        if (message === EMPTY_SYMBOL) {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: string | undefined }).message = undefined;
        } else {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: ReadonlyMeta<L>["message"] }).message = message;
        }

        if (error) {
            (rest as unknown as Omit<ReadonlyMeta<L>, "error"> & { error: ReadonlyMeta<L>["error"] }).error = serializeError(error, this.errorOptions);
        }

        if (context) {
            const newContext: ReadonlyMeta<L>["context"] = [];

            for (const item of context) {
                if (item === EMPTY_SYMBOL) {
                    continue;
                }

                if (item instanceof Error) {
                    newContext.push(serializeError(item, this.errorOptions));
                } else {
                    newContext.push(item);
                }
            }

            (rest as unknown as Omit<ReadonlyMeta<L>, "context"> & { context: ReadonlyMeta<L>["context"] }).context = newContext;
        }

        // eslint-disable-next-line no-underscore-dangle
        this._log((this.stringify as typeof stringify)(rest) as string, type.level);
    }

    /**
     * Template method for outputting the JSON log message.
     *
     * Subclasses must implement this method to define how the JSON message
     * is actually written (to console, file, network, etc.).
     * @param message The JSON-formatted log message
     * @param logLevel The log level of the message
     * @protected
     * @abstract
     */
    protected abstract _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void;
}
