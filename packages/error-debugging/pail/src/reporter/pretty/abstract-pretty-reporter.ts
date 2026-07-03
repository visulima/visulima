import type { LiteralUnion } from "type-fest";

import { LOG_TYPES } from "../../constants";
import type { DefaultLogTypes, LoggerTypesAwareReporter, LoggerTypesConfig, ReadonlyMeta } from "../../types";

/**
 * Default date formatter for pretty reporters.
 *
 * Formats a Date object as HH:MM:SS (24-hour format).
 * @param date The date to format
 * @returns Formatted time string
 * @example
 * ```typescript
 * dateFormatter(new Date()); // "14:30:25"
 * ```
 */
export const dateFormatter = (date: Date): string => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");

/**
 * Abstract Pretty Reporter.
 *
 * Base class for pretty-printing reporters that format log messages with colors,
 * styles, and structured layout. Provides common functionality for styling options
 * and logger type configuration.
 * @template T - Custom logger type names
 * @template L - Log level types
 * @example
 * ```typescript
 * class CustomPrettyReporter extends AbstractPrettyReporter {
 *   public log(meta: ReadonlyMeta) {
 *     const formatted = this.formatMessage(meta);
 *     console.log(formatted);
 *   }
 * }
 * ```
 */
export abstract class AbstractPrettyReporter<T extends string = string, L extends string = string> implements LoggerTypesAwareReporter<T, L> {
    /** Styling options for pretty formatting */
    protected readonly styles: PrettyStyleOptions;

    /** Logger type configurations for styling */
    protected loggerTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    /**
     * Creates a new AbstractPrettyReporter instance.
     * @param options Styling options for pretty formatting
     * @protected
     */
    protected constructor(options: Partial<PrettyStyleOptions>) {
        this.styles = {
            bold: {
                label: false,
            },
            dateFormatter,
            underline: {
                label: false,
                message: false,
                prefix: false,
                suffix: false,
            },
            uppercase: {
                label: false,
            },
            ...options,
        } as PrettyStyleOptions;

        this.loggerTypes = LOG_TYPES as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;
    }

    /**
     * Sets the logger types configuration for styling.
     * @param types Logger type configurations with colors and labels
     */
    public setLoggerTypes(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): void {
        this.loggerTypes = types;
    }

    /**
     * Logs a message with pretty formatting.
     * @param meta The log metadata to format and output
     * @abstract
     */
    public abstract log(meta: ReadonlyMeta<L>): void;
}

/**
 * Options for configuring pretty reporter styling.
 */
export type PrettyStyleOptions = {
    /** Bold styling options */
    bold: {
        /** Whether to bold the label text */
        label: boolean;
    };
    /** Function to format dates in log output */
    dateFormatter: (date: Date) => string;
    /** Maximum length of message before line break (optional) */
    messageLength: number | undefined;
    /** Underline styling options */
    underline: {
        /** Whether to underline the label */
        label: boolean;
        /** Whether to underline prefixes */
        prefix: boolean;
        /** Whether to underline suffixes */
        suffix: boolean;
    };
    /** Uppercase styling options */
    uppercase: {
        /** Whether to uppercase the label text */
        label: boolean;
    };
};
