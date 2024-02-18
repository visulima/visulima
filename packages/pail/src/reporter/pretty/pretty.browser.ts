import type { ReadonlyMeta } from "../../types";
import { getLongestLabel } from "../../util/get-longest-label";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";
import colorize from "@visulima/colorize";

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

    public async log(meta: ReadonlyMeta<L>): Promise<void> {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(meta.type.level);

        const { badge, context, date, error, file, groups, label, message, prefix, repeated, scope, suffix, type } = meta;

        const colorized = this._loggerTypes[type.name as keyof typeof this._loggerTypes].color ?? colorize.white;
        const items = [];

        if (date) {
            items.push(colorize.grey(this._styles.dateFormatter(new Date(date))) + " ");
        }

        consoleLogFunction(...items);
    }
}
