import type { ReadonlyMeta } from "../../types";
import { getLongestLabel } from "../../util/get-longest-label";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

export class PrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> {
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

    // eslint-disable-next-line class-methods-use-this
    public log(meta: ReadonlyMeta<L>): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(meta.type.level);

        const { badge, context, date, error, file, groups, label, message, prefix, repeated, scope, suffix, type } = meta;

        const colorized = this._loggerTypes[type.name as keyof typeof this._loggerTypes].color ?? "color: #fff;";
        const coloredMessage = [];
        const css = [];

        if (date) {
            coloredMessage.push("%c" + this._styles.dateFormatter(new Date(date)));
            css.push("color: #888;");
        }

        consoleLogFunction(coloredMessage.join(""), ...css);
    }
}
