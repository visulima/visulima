import chalk from "chalk";

import type { DefaultLogLevels, Meta } from "../../types";
import writeConsoleLogBasedOnLevel from "../../util/write-console-log";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

class BrowserPrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> {
    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super(options);
    }

    protected override _formatMessage(data: Meta<L>): string {
        let { badge, date, file, label, prefix, scope, suffix } = data;

        if (prefix) {
            prefix = this._styles.underline.prefix ? chalk.underline(prefix) : prefix;
        }

        return `${date} ${file?.name} ${scope} > ${prefix} ${badge} ${label} ${suffix}`;
    }

    protected override _log(message: string, logLevel: DefaultLogLevels | L): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }

    protected override _formatError(error: Error): string {
        return error.stack || error.message;
    }
}

export default BrowserPrettyReporter;
