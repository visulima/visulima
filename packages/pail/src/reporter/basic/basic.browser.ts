import type { Rfc5424LogLevels } from "../../types";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import { AbstractBasicReporter } from "./abstract-basic-reporter";

export class BasicReporter<L extends string = never> extends AbstractBasicReporter<L> {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _log(message: string, logLevel: L | Rfc5424LogLevels): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}
