import type { ReadonlyMeta, Reporter } from "../../types";
import writeConsoleLogBasedOnLevel from "../../utils/write-console-log-based-on-level";

class RawReporter<L extends string = string> implements Reporter<L> {
    // eslint-disable-next-line class-methods-use-this
    public log(meta: ReadonlyMeta<L>): void {
        const { context = [], message, type } = meta;

        const consoleLogFunction = writeConsoleLogBasedOnLevel(type.level);

        consoleLogFunction(message, ...context);
    }
}

export default RawReporter;
