import { underline } from "@visulima/colorize";
import type { LiteralUnion } from "type-fest";

import type { ReadonlyMeta, Rfc5424LogLevels } from "../../types";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

export class PrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> {
    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super(options);
    }

    protected override _formatMessage(data: ReadonlyMeta<L>): string {
        const { badge, date, file, label, scope, suffix } = data;
        let { prefix } = data;

        if (prefix) {
            prefix = this._styles.underline.prefix ? underline(prefix) : prefix;
        }

        return date.toString() + " " + file?.name + " " + scope?.join("|") + " > " + prefix + " " + badge + " " + label + " " + suffix;
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _log(message: string, logLevel: LiteralUnion<Rfc5424LogLevels, L>): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _formatError(error: Error): string {
        return error.stack ?? error.message;
    }
}
