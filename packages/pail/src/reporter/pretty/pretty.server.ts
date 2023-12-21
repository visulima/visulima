import { sep } from "node:path";

import type { ColorName } from "chalk";
import chalk from "chalk";
import stringLength from "string-length";
import terminalSize from "terminal-size";
import wrapAnsi from "wrap-ansi";

import type { DefaultLogLevels, Meta, Serializer, StreamAwareReporter } from "../../types";
import getLongestLabel from "../../util/get-longest-label";
import writeStream from "../../util/write-stream";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

class PrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> implements StreamAwareReporter<L> {
    private _stdout: NodeJS.WriteStream | undefined;

    private _stderr: NodeJS.WriteStream | undefined;

    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super({
            dateFormatter: (date: Date) => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"),
            uppercase: {
                label: true,
                ...options.uppercase,
            },
            ...options,
        });
    }

    public setStdout(stdout: NodeJS.WriteStream) {
        this._stdout = stdout;
    }

    public setStderr(stderr: NodeJS.WriteStream) {
        this._stderr = stderr;
    }

    protected override _formatMessage(data: Meta<L>): string {
        const { columns } = terminalSize();

        let size = columns;

        if (typeof this._styles.messageLength === "number") {
            size = this._styles.messageLength;
        }

        const { badge, date, repeated, error, file, label, message, prefix, scope, suffix, type } = data;

        const colorize = this._loggerTypes[type.name as keyof typeof this._loggerTypes].color
            ? chalk[this._loggerTypes[type.name as keyof typeof this._loggerTypes].color as ColorName]
            : chalk.white;

        let items = [];

        if (date) {
            items.push(chalk.grey(this._styles.dateFormatter(new Date(date))));
        }

        if (badge) {
            items.push(colorize(badge));
        }

        const longestLabel = getLongestLabel<L, T>(this._loggerTypes);

        if (label) {
            const replacement = ".".repeat(longestLabel.length - stringLength(label));

            items.push(colorize(this._formatLabel(label)));

            if (repeated) {
                items.push(chalk.bgGray.white(`[${repeated}x]`));
            }

            items.push((replacement.length > 0 ? " " : "") + chalk.grey(replacement));
        } else {
            // plus 2 for the space and the dot
            items.push(chalk.grey(".".repeat(longestLabel.length + 2)));
        }

        if (scope && scope.length > 0) {
            items.push(chalk.grey(`[${scope.join(" | ")}]`));
        }

        if (prefix) {
            items.push(chalk.grey(`${scope && scope.length > 0 ? ". " : ""}[${this._styles.underline.prefix ? chalk.underline(prefix) : prefix}]`));
        }

        if (items.length > 0) {
            items = items.map((item) => `${item} `);
        }

        const titleSize = stringLength(items.join(" "));

        if (file) {
            const fileMessage = `${file.name}${file.line ? `:${file.line}` : ""}`;
            const fileMessageSize = stringLength(fileMessage);

            items.push(chalk.grey(`${".".repeat(size - titleSize - fileMessageSize - 2)} ${fileMessage}`));
        } else {
            items.push(chalk.grey(".".repeat(size - titleSize - 1)));
        }

        if (items.length > 0) {
            items.push("\n\n");
        }

        if (message) {
            items.push(
                wrapAnsi(message, size - 3, {
                    hard: true,
                    trim: true,
                    wordWrap: true,
                }),
            );
        } else if (error) {
            items.push(this._formatError(error, size));
        }

        if (suffix) {
            items.push("\n");
            items.push(chalk.grey(this._styles.underline.suffix ? chalk.underline(suffix) : suffix));
        }

        return `${items.join("")}\n`;
    }

    protected override _log(message: string, logLevel: DefaultLogLevels | L) {
        writeStream(`${message}\n`, ["error", "warn"].includes(logLevel) ? this._stderr ?? process.stderr : this._stdout ?? process.stdout);
    }

    private _formatLabel(label: string): string {
        let formattedLabel = this._styles.uppercase.label ? label.toUpperCase() : label;

        formattedLabel = this._styles.underline.label ? chalk.underline(formattedLabel) : formattedLabel;

        if (this._styles.bold.label) {
            formattedLabel = chalk.bold(formattedLabel);
        }

        return formattedLabel;
    }

    protected override _formatError(error: Error, size: number): string {
        if (!this._serializers.has("error")) {
            return "Error object could not be serialized, please add the error serializer to pail.";
        }

        const errorSerializer = this._serializers.get("error") as Serializer;
        const { message, name, stack } = errorSerializer.serialize(error);

        const items: string[] = [];
        const cwd = process.cwd() + sep;

        items.push(chalk.red(name), "\n");
        items.push(
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
                .map((line: string) => line.trim().replace("file://", "").replace(cwd, ""));

            items.push("\n");
            items.push(
                lines.map((line: string) => `  ${line.replace(/^at +/, (m) => chalk.gray(m)).replace(/\((.+)\)/, (_, m) => `(${chalk.cyan(m)})`)}`).join("\n"),
            );
        }

        return items.join("");
    }
}

export default PrettyReporter;
