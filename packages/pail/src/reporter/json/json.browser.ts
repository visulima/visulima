import type { LiteralUnion } from "type-fest";

import type { Rfc5424LogLevels } from "../../types";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import { AbstractJsonReporter } from "./abstract-json-reporter";

export class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    protected override _log(message: string, logLevel: LiteralUnion<Rfc5424LogLevels, L>): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}
