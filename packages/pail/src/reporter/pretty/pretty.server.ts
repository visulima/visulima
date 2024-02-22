import colorize, { bgGrey, bold, cyan, grey, red, underline, white } from "@visulima/colorize";
import type { stringify } from "safe-stable-stringify";
import stringLength from "string-length";
import terminalSize from "terminal-size";
import type { LiteralUnion } from "type-fest";
import wrapAnsi from "wrap-ansi";

import type { ExtendedRfc5424LogLevels, ReadonlyMeta, StreamAwareReporter } from "../../types";
import { getLongestBadge } from "../../util/get-longest-badge";
import { getLongestLabel } from "../../util/get-longest-label";
import { writeStream } from "../../util/write-stream";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

export class PrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> implements StreamAwareReporter<L> {
    #stdout: NodeJS.WriteStream | undefined;

    #stderr: NodeJS.WriteStream | undefined;

    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super({
            uppercase: {
                label: true,
                ...options.uppercase,
            },
            ...options,
        });
    }

    public setStdout(stdout: NodeJS.WriteStream): void {
        this.#stdout = stdout;
    }

    public setStderr(stderr: NodeJS.WriteStream): void {
        this.#stderr = stderr;
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

        const { badge, context, date, error, file, groups, label, message, prefix, repeated, scope, suffix, traceError, type } = data;

        const { color } = this._loggerTypes[type.name as keyof typeof this._loggerTypes];
        // eslint-disable-next-line security/detect-object-injection
        const colorized = color ? colorize[color] : white;

        const groupSpaces: string = groups.map(() => "   ").join("");
        const items: string[] = [];

        if (groups.length > 0) {
            items.push((groupSpaces + grey("[" + groups.at(-1) + "] ")) as string);
        }

        if (date) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            items.push(grey(this._styles.dateFormatter(new Date(date))) + " ");
        }

        if (badge) {
            items.push(colorized(badge) as string);
        } else {
            const longestBadge: string = getLongestBadge<L, T>(this._loggerTypes);

            if (longestBadge.length > 0) {
                items.push(grey(".".repeat(longestBadge.length)) + " ");
            }
        }

        const longestLabel: string = getLongestLabel<L, T>(this._loggerTypes);

        if (label) {
            items.push(colorized(this._formatLabel(label as string)) + " ", grey(".".repeat(longestLabel.length - stringLength(label as string))));
        } else {
            // plus 2 for the space and the dot
            items.push(grey(".".repeat(longestLabel.length + 2)));
        }

        if (repeated) {
            items.push(bgGrey.white("[" + repeated + "x]") + " ");
        }

        if (Array.isArray(scope) && scope.length > 0) {
            items.push(grey(" [" + scope.join(" | ") + "] "));
        }

        if (prefix) {
            items.push(
                grey(
                    (Array.isArray(scope) && scope.length > 0 ? ". " : " ") +
                        "[" +
                        (this._styles.underline.prefix ? underline(prefix as string) : prefix) +
                        "] ",
                ),
            );
        }

        const titleSize = stringLength(items.join(" "));

        if (file) {
            const fileMessage = file.name + (file.line ? ":" + file.line : "");
            const fileMessageSize = stringLength(fileMessage);

            items.push(grey(".".repeat(size - titleSize - fileMessageSize - 2) + " " + fileMessage));
        } else {
            items.push(grey(".".repeat(size - titleSize - 1)));
        }

        if (items.length > 0) {
            items.push("\n\n");
        }

        if (message) {
            const formattedMessage: string | undefined = typeof message === "string" ? message : (this._stringify as typeof stringify)(message);

            items.push(
                groupSpaces +
                    wrapAnsi(formattedMessage ?? "undefined", size - 3, {
                        hard: true,
                        trim: true,
                        wordWrap: true,
                    }),
            );

            if (context) {
                items.push("\n", groupSpaces + grey((this._stringify as typeof stringify)(context)));
            }
        }

        if (error) {
            items.push(this._formatError(error as Error, size, groupSpaces));
        }

        if (traceError) {
            items.push(this._formatError(traceError as Error, size, groupSpaces, true));
        }

        if (suffix) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            items.push("\n", groupSpaces + grey(this._styles.underline.suffix ? underline(suffix as string) : suffix));
        }

        return items.join("") + "\n";
    }

    protected _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const stream = ["error", "trace", "warn"].includes(logLevel as string) ? this.#stderr ?? process.stderr : this.#stdout ?? process.stdout;

        writeStream(message + "\n", stream);
    }

    // eslint-disable-next-line class-methods-use-this
    private _formatError(error: Error, size: number, groupSpaces: string, hideName = false): string {
        const { message, name, stack } = error;

        const items: string[] = [];

        items.push(
            ...(hideName ? [] : [groupSpaces + red(name), ": "]),
            wrapAnsi(message, size - 3, {
                hard: true,
                trim: true,
                wordWrap: true,
            }),
        );

        if (stack) {
            const lines = stack
                .split("\n")
                .splice(1)
                .map((line: string) => groupSpaces + line.trim().replace("file://", ""))
                .filter((line: string) => !line.includes("/pail/dist"));

            items.push(
                "\n",
                lines
                    .map((line: string) => "  " + line.replace(/^at +/, (m) => grey(m)).replace(/\((.+)\)/, (_, m) => "(" + cyan(m as string) + ")"))
                    .join("\n"),
            );
        }

        return items.join("");
    }

    private _formatLabel(label: string): string {
        let formattedLabel = this._styles.uppercase.label ? label.toUpperCase() : label;

        formattedLabel = this._styles.underline.label ? underline(formattedLabel) : formattedLabel;

        if (this._styles.bold.label) {
            formattedLabel = bold(formattedLabel);
        }

        return formattedLabel;
    }
}
