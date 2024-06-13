import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../../types";
import writeConsoleLogBasedOnLevel from "../../utils/write-console-log";
import AbstractJsonReporter from "./abstract-json-reporter";

class JsonReporter<L extends string = string> extends AbstractJsonReporter<L> {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}

export default JsonReporter;
