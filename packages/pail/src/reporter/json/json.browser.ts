import type { DefaultLogLevels } from "../../types";
import writeConsoleLogBasedOnLevel from "../../util/write-console-log";
import type { Options } from "./abstract-json-reporter";
import { AbstractJsonReporter } from "./abstract-json-reporter";

class BrowserJsonReporter<L extends string = never> extends AbstractJsonReporter<L> {
    public constructor(options: Options = {}) {
        super(options);
    }

    protected override _log(message: string, logLevel: DefaultLogLevels | L): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}

export default BrowserJsonReporter;
