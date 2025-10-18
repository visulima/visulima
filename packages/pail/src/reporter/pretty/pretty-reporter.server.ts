import { stderr, stdout } from "node:process";

import colorize, { bgGrey, cyan, green, greenBright, grey, red, underline, white } from "@visulima/colorize";
import type { RenderErrorOptions } from "@visulima/error/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderError } from "@visulima/error/error";
import type { Options as InspectorOptions } from "@visulima/inspector";
// eslint-disable-next-line import/no-extraneous-dependencies
import { inspect } from "@visulima/inspector";
// eslint-disable-next-line import/no-extraneous-dependencies
import { getStringWidth, wordWrap, WrapMode } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";
import type { LiteralUnion } from "type-fest";

import { EMPTY_SYMBOL } from "../../constants";
import type InteractiveManager from "../../interactive/interactive-manager";
import type { ExtendedRfc5424LogLevels, InteractiveStreamReporter, ReadonlyMeta } from "../../types";
import getLongestBadge from "../../utils/get-longest-badge";
import getLongestLabel from "../../utils/get-longest-label";
import writeStream from "../../utils/write-stream";
import defaultInspectorConfig from "../utils/default-inspector-config";
import formatLabel from "../utils/format-label";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

const pailFileFilter = (line: string) => !/[\\/]pail[\\/]dist/.test(line);

/**
 * Options for configuring the Server Pretty Reporter.
 */
export type PrettyReporterOptions = PrettyStyleOptions & {
    /** Error rendering options */
    error: Partial<Omit<RenderErrorOptions, "color" | "prefix" | "indentation">>;
    /** Object inspection options */
    inspect: Partial<InspectorOptions>;
};

/**
 * Server Pretty Reporter.
 *
 * A comprehensive pretty-printing reporter for Node.js server environments that
 * formats log messages with colors, structured layout, and advanced features like
 * error rendering, object inspection, and interactive terminal support.
 * @template T - Custom logger type names
 * @template L - Log level types
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   reporters: [new PrettyReporter({
 *     bold: { label: true },
 *     error: { color: { title: 'red' } }
 *   })]
 * });
 *
 * logger.info("Server started on port 3000");
 * logger.error("Database error", dbError);
 * ```
 */
export class PrettyReporter<T extends string = string, L extends string = string> extends AbstractPrettyReporter<T, L> implements InteractiveStreamReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    readonly #inspectOptions: Partial<InspectorOptions>;

    readonly #errorOptions: Partial<Omit<RenderErrorOptions, "message | prefix">>;

    /**
     * Creates a new Server Pretty Reporter instance.
     * @param options Configuration options for styling, error rendering, and object inspection
     */
    public constructor(options: Partial<PrettyReporterOptions> = {}) {
        const { error: errorOptions, inspect: inspectOptions, ...rest } = options;

        super({
            uppercase: {
                label: true,
                ...rest.uppercase,
            },
            ...rest,
        });

        this.#inspectOptions = { ...defaultInspectorConfig, ...inspectOptions };
        this.#errorOptions = {
            ...errorOptions,
            color: {
                fileLine: green,
                hint: cyan,
                marker: red,
                message: red,
                method: greenBright,
                title: red,
            },
        };
        this.#stdout = stdout;
        this.#stderr = stderr;
    }

    /**
     * Sets the stdout stream for the reporter.
     * @param stdout_ The writable stream to use for standard output
     */
    public setStdout(stdout_: NodeJS.WriteStream): void {
        this.#stdout = stdout_;
    }

    /**
     * Sets the stderr stream for the reporter.
     * @param stderr_ The writable stream to use for error output
     */
    public setStderr(stderr_: NodeJS.WriteStream): void {
        this.#stderr = stderr_;
    }

    /**
     * Sets the interactive manager for handling interactive output.
     * @param manager The interactive manager instance, or undefined to disable
     */
    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    /**
     * Enables or disables interactive mode.
     * @param interactive Whether to enable interactive terminal features
     */
    public setIsInteractive(interactive: boolean): void {
        this.#interactive = interactive;
    }

    public log(meta: ReadonlyMeta<L>): void {
        // eslint-disable-next-line no-underscore-dangle
        this._log(this._formatMessage(meta as ReadonlyMeta<L>), meta.type.level);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity, no-underscore-dangle
    protected _formatMessage(data: ReadonlyMeta<L>): string {
        const { columns } = terminalSize();

        let size = columns;

        if (typeof this.styles.messageLength === "number") {
            size = this.styles.messageLength;
        }

        // @ts-ignore - @TODO: check rollup-plugin-dts
        const { badge, context, date, error, file, groups, label, message, prefix, repeated, scope, suffix, traceError, type } = data;

        const { color } = this.loggerTypes[type.name as keyof typeof this.loggerTypes];

        const colorized = color ? colorize[color] : white;

        const groupSpaces: string = groups.map(() => "    ").join("");
        const items: string[] = [];

        if (groups.length > 0) {
            items.push(`${groupSpaces + grey(`[${groups.at(-1)}]`)} `);
        }

        if (date) {
            items.push(`${grey(this.styles.dateFormatter(typeof date === "string" ? new Date(date) : date))} `);
        }

        if (badge) {
            items.push(colorized(badge) as string);
        } else {
            const longestBadge: string = getLongestBadge<L, T>(this.loggerTypes);

            if (longestBadge.length > 0) {
                items.push(`${grey(".".repeat(longestBadge.length))} `);
            }
        }

        const longestLabel: string = getLongestLabel<L, T>(this.loggerTypes);

        if (label) {
            const longestLabelWidth = getStringWidth(longestLabel);
            const labelWidth = getStringWidth(label as string);

            items.push(`${colorized(formatLabel(label as string, this.styles))} `, grey(".".repeat(Math.max(0, longestLabelWidth - labelWidth))));
        } else {
            // plus 2 for the space and the dot
            items.push(grey(".".repeat(longestLabel.length + 2)));
        }

        if (repeated) {
            items.push(`${bgGrey.white(`[${repeated}x]`)} `);
        }

        if (Array.isArray(scope) && scope.length > 0) {
            items.push(` ${grey(`[${scope.join(" > ")}]`)} `);
        }

        if (prefix) {
            items.push(
                `${grey(`${Array.isArray(scope) && scope.length > 0 ? ". " : " "}[${this.styles.underline.prefix ? underline(prefix as string) : prefix}]`)} `,
            );
        }

        const titleSize = getStringWidth(items.join(" "));

        if (file) {
            const fileMessage = file.name + (file.line ? `:${file.line}` : "");
            const fileMessageSize = getStringWidth(fileMessage);

            if (fileMessageSize + titleSize + 2 > size) {
                items.push(grey(` ${fileMessage}`));
            } else {
                const dots = Math.max(0, size - titleSize - fileMessageSize - 2);

                items.push(grey(`${".".repeat(dots)} ${fileMessage}`));
            }
        } else {
            items.push(grey(".".repeat(Math.max(0, size - titleSize - 1))));
        }

        if (items.length > 0) {
            items.push("\n\n");
        }

        if (message !== EMPTY_SYMBOL) {
            const formattedMessage: string = typeof message === "string" ? message : inspect(message, this.#inspectOptions);

            items.push(
                groupSpaces
                + wordWrap(formattedMessage, {
                    trim: false,
                    width: size - 3,
                    wrapMode: WrapMode.STRICT_WIDTH,
                }),
            );
        }

        if (context) {
            let hasError = false;

            items.push(
                ...context.map((value) => {
                    if (value instanceof Error) {
                        hasError = true;

                        return `\n\n${renderError(value as Error, {
                            ...this.#errorOptions,
                            filterStacktrace: pailFileFilter,
                            prefix: groupSpaces,
                        })}`;
                    }

                    if (typeof value === "object") {
                        return ` ${inspect(value, this.#inspectOptions)}`;
                    }

                    const newValue = (hasError ? "\n\n" : " ") + value;

                    hasError = false;

                    return newValue;
                }),
            );
        }

        if (error) {
            items.push(
                renderError(error as Error, {
                    ...this.#errorOptions,
                    filterStacktrace: pailFileFilter,
                    prefix: groupSpaces,
                }),
            );
        }

        if (traceError) {
            items.push(
                `\n\n${renderError(traceError as Error, {
                    ...this.#errorOptions,
                    filterStacktrace: pailFileFilter,
                    hideErrorCauseCodeView: true,
                    hideErrorCodeView: true,
                    hideErrorErrorsCodeView: true,
                    hideMessage: true,
                    prefix: groupSpaces,
                })}`,
            );
        }

        if (suffix) {
            items.push("\n", groupSpaces + grey(this.styles.underline.suffix ? underline(suffix as string) : suffix));
        }

        return items.join("");
    }

    // eslint-disable-next-line no-underscore-dangle
    protected _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const streamType = ["error", "trace", "warn"].includes(logLevel as string) ? "stderr" : "stdout";
        const stream = streamType === "stderr" ? this.#stderr : this.#stdout;

        if (this.#interactive && this.#interactiveManager !== undefined && stream.isTTY) {
            this.#interactiveManager.update(streamType, message.split("\n"), 0);
        } else {
            writeStream(`${message}\n`, stream);
        }
    }
}
