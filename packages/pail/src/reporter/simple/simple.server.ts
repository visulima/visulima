import { stderr, stdout } from "node:process";

import colorize, { bgGrey, bold, cyan, green, greenBright, grey, red, underline, white } from "@visulima/colorize";
import type { RenderErrorOptions } from "@visulima/error";
import { renderError } from "@visulima/error";
import type { Options as InspectorOptions } from "@visulima/inspector";
import { inspect } from "@visulima/inspector";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";
import type { LiteralUnion } from "type-fest";
import { getStringWidth, wordWrap, WrapMode } from "@visulima/string";

import { EMPTY_SYMBOL } from "../../constants";
import type InteractiveManager from "../../interactive/interactive-manager";
import type { ExtendedRfc5424LogLevels, InteractiveStreamReporter, ReadonlyMeta } from "../../types";
import getLongestBadge from "../../utils/get-longest-badge";
import getLongestLabel from "../../utils/get-longest-label";
import writeStream from "../../utils/write-stream";
import type { PrettyStyleOptions } from "../pretty/abstract-pretty-reporter";
import { AbstractPrettyReporter } from "../pretty/abstract-pretty-reporter";
import defaultInspectorConfig from "../utils/default-inspector-config";
import formatLabel from "../utils/format-label";

const pailFileFilter = (line: string) => !/[\\/]pail[\\/]dist/.test(line);

export type SimpleReporterOptions = PrettyStyleOptions & {
    error: Partial<Omit<RenderErrorOptions, "color | prefix | indentation">>;
    inspect: Partial<InspectorOptions>;
};

export class SimpleReporter<T extends string = string, L extends string = string> extends AbstractPrettyReporter<T, L> implements InteractiveStreamReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    readonly #inspectOptions: Partial<InspectorOptions>;

    readonly #errorOptions: Partial<Omit<RenderErrorOptions, "message | prefix">>;

    public constructor(options: Partial<SimpleReporterOptions> = {}) {
        const { error: errorOptions, inspect: inspectOptions, ...rest } = options;

        super({
            uppercase: {
                label: true,
                ...rest.uppercase,
            },
            ...rest,
        });

        this.#inspectOptions = { ...defaultInspectorConfig, indent: undefined, ...inspectOptions };
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

    public setStdout(stdout_: NodeJS.WriteStream): void {
        this.#stdout = stdout_;
    }

    public setStderr(stderr_: NodeJS.WriteStream): void {
        this.#stderr = stderr_;
    }

    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    public setIsInteractive(interactive: boolean): void {
        this.#interactive = interactive;
    }

    public log(meta: ReadonlyMeta<L>): void {
        const message = this.formatMessage(meta as ReadonlyMeta<L>);
        const logLevel = meta.type.level as LiteralUnion<ExtendedRfc5424LogLevels, L>;

        const streamType = ["error", "trace", "warn"].includes(logLevel as string) ? "stderr" : "stdout";
        const stream = streamType === "stderr" ? this.#stderr : this.#stdout;

        if (this.#interactive && this.#interactiveManager !== undefined && stream.isTTY) {
            this.#interactiveManager.update(streamType, message.split("\n"), 0);
        } else {
            writeStream(`${message}\n`, stream);
        }
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    protected formatMessage(data: ReadonlyMeta<L>): string {
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
            items.push(`${groupSpaces + grey(`[${groups.at(-1)}]`)} ` as string);
        }

        if (date) {
            items.push(`${grey(this.styles.dateFormatter(typeof date === "string" ? new Date(date) : date))} `);
        }

        if (badge) {
            items.push(bold(colorized(badge) as string));
        } else {
            const longestBadge: string = getLongestBadge<L, T>(this.loggerTypes);

            if (longestBadge.length > 0) {
                items.push(grey(" ".repeat(longestBadge.length)));
            }
        }

        const longestLabel: string = getLongestLabel<L, T>(this.loggerTypes);

        if (label) {
            items.push(`${bold(colorized(formatLabel(label as string, this.styles)))} `, " ".repeat(longestLabel.length - getStringWidth(label as string)));
        } else {
            items.push(" ".repeat(longestLabel.length + 1));
        }

        if (repeated) {
            items.push(`${bgGrey.white(`[${repeated}x]`)} `);
        }

        if (Array.isArray(scope) && scope.length > 0) {
            items.push(`${grey(`[${scope.join(" > ")}]`)} `);
        }

        if (prefix) {
            items.push(`${grey(`[${this.styles.underline.prefix ? underline(prefix as string) : prefix}]`)} `);
        }

        const titleSize = getStringWidth(items.join(""));

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
            items.push(` ${groupSpaces}${grey(this.styles.underline.suffix ? underline(suffix as string) : suffix)}`);
        }

        if (file) {
            const fileMessage = file.name + (file.line ? `:${file.line}` : "");

            items.push("\n", grey("Caller: "), " ".repeat(titleSize - 8), fileMessage, "\n");
        }

        return items.join("");
    }
}
