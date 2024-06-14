import { stderr, stdout } from "node:process";

import colorize, { bgGrey, bold, grey, underline, white } from "@visulima/colorize";
import type { Options as InspectorOptions } from "@visulima/inspector";
import { inspect } from "@visulima/inspector";
// eslint-disable-next-line import/no-extraneous-dependencies
import stringLength from "string-length";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";
import type { LiteralUnion } from "type-fest";
// eslint-disable-next-line import/no-extraneous-dependencies
import wrapAnsi from "wrap-ansi";

import { EMPTY_SYMBOL } from "../../constants";
import type InteractiveManager from "../../interactive/interactive-manager";
import type { ExtendedRfc5424LogLevels, InteractiveStreamReporter, ReadonlyMeta } from "../../types";
import getLongestBadge from "../../utils/get-longest-badge";
import getLongestLabel from "../../utils/get-longest-label";
import writeStream from "../../utils/write-stream";
import type { PrettyStyleOptions } from "../pretty/abstract-pretty-reporter";
import { AbstractPrettyReporter } from "../pretty/abstract-pretty-reporter";
import defaultInspectorConfig from "../utils/default-inspector-config";
import formatError from "../utils/format-error";
import formatLabel from "../utils/format-label";

type PrettyReporterOptions = PrettyStyleOptions & {
    inspect: InspectorOptions;
};

class SimpleReporter<T extends string = string, L extends string = string> extends AbstractPrettyReporter<T, L> implements InteractiveStreamReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    readonly #inspectOptions: Partial<InspectorOptions>;

    public constructor(options: Partial<PrettyReporterOptions> = {}) {
        const { inspect: inspectOptions, ...rest } = options;

        super({
            uppercase: {
                label: true,
                ...rest.uppercase,
            },
            ...rest,
        });

        this.#inspectOptions = { ...defaultInspectorConfig, indent: undefined, ...inspectOptions };
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
        this._log(this._formatMessage(meta as ReadonlyMeta<L>), meta.type.level);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    protected _formatMessage(data: ReadonlyMeta<L>): string {
        const { columns } = terminalSize();

        let size = columns;

        if (typeof this._styles.messageLength === "number") {
            size = this._styles.messageLength;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error
        // @ts-ignore - @TODO: check rollup-plugin-dts
        const { badge, context, date, error, file, groups, label, message, prefix, repeated, scope, suffix, traceError, type } = data;

        const { color } = this._loggerTypes[type.name as keyof typeof this._loggerTypes];
        // eslint-disable-next-line security/detect-object-injection
        const colorized = color ? colorize[color] : white;

        const groupSpaces: string = groups.map(() => "    ").join("");
        const items: string[] = [];

        if (groups.length > 0) {
            items.push((groupSpaces + grey("[" + groups.at(-1) + "]") + " ") as string);
        }

        if (date) {
            items.push(grey(this._styles.dateFormatter(typeof date === "string" ? new Date(date) : date)) + " ");
        }

        if (badge) {
            items.push(bold(colorized(badge) as string));
        } else {
            const longestBadge: string = getLongestBadge<L, T>(this._loggerTypes);

            if (longestBadge.length > 0) {
                items.push(grey(" ".repeat(longestBadge.length)));
            }
        }

        const longestLabel: string = getLongestLabel<L, T>(this._loggerTypes);

        if (label) {
            items.push(bold(colorized(formatLabel(label as string, this._styles))) + " ", " ".repeat(longestLabel.length - stringLength(label as string)));
        } else {
            items.push(" ".repeat(longestLabel.length + 1));
        }

        if (repeated) {
            items.push(bgGrey.white("[" + repeated + "x]") + " ");
        }

        if (Array.isArray(scope) && scope.length > 0) {
            items.push(grey("[" + scope.join(" > ") + "]") + " ");
        }

        if (prefix) {
            items.push(grey("[" + (this._styles.underline.prefix ? underline(prefix as string) : prefix) + "]") + " ");
        }

        const titleSize = stringLength(items.join(""));

        if (message !== EMPTY_SYMBOL) {
            const formattedMessage: string = typeof message === "string" ? message : inspect(message, this.#inspectOptions);

            items.push(
                groupSpaces +
                    wrapAnsi(formattedMessage, size - 3, {
                        hard: true,
                        trim: true,
                        wordWrap: true,
                    }),
            );
        }

        if (context) {
            let hasError = false;

            items.push(
                ...context.map((value) => {
                    if (value instanceof Error) {
                        hasError = true;
                        return "\n\n" + formatError(value, size, groupSpaces);
                    }

                    if (typeof value === "object") {
                        return " " + inspect(value, this.#inspectOptions);
                    }

                    const newValue = (hasError ? "\n\n" : " ") + value;

                    hasError = false;

                    return newValue;
                }),
            );
        }

        if (error) {
            items.push(formatError(error as Error, size, groupSpaces));
        }

        if (traceError) {
            items.push(formatError(traceError as Error, size, groupSpaces, true));
        }

        if (suffix) {
            items.push(" " + groupSpaces + grey(this._styles.underline.suffix ? underline(suffix as string) : suffix));
        }

        if (file) {
            const fileMessage = file.name + (file.line ? ":" + file.line : "");

            items.push("\n", grey("Caller: "), " ".repeat(titleSize - 8), fileMessage, "\n");
        }

        return items.join("");
    }

    protected _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const streamType = ["error", "trace", "warn"].includes(logLevel as string) ? "stderr" : "stdout";
        const stream = streamType === "stderr" ? this.#stderr : this.#stdout;

        if (this.#interactive && this.#interactiveManager !== undefined && stream.isTTY) {
            this.#interactiveManager.update(streamType, message.split("\n"), 0);
        } else {
            writeStream(message + "\n", stream);
        }
    }
}

export default SimpleReporter;
