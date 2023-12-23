import type { Rfc5424LogLevels } from "../../types";
import writeConsoleLogBasedOnLevel from "../../util/write-console-log";
import AbstractJsonReporter from "./abstract-json-reporter";

class BrowserJsonReporter<L extends string = never> extends AbstractJsonReporter<L> {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _log(message: string, logLevel: L | Rfc5424LogLevels): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}

export default BrowserJsonReporter;
