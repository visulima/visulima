import type { Meta, Processor } from "../../types";
import getCallerFilename from "./get-caller-filename";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace VisulimaPail {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interface CustomMeta<L> {
            file:
                | {
                    column: number | undefined;
                    line: number | undefined;
                    name: string | undefined;
                }
                | undefined;
        }
    }
}

class CallerProcessor<L extends string = string> implements Processor<L> {
    // eslint-disable-next-line class-methods-use-this
    public process(meta: Meta<L>): Meta<L> {
        const { columnNumber, fileName, lineNumber } = getCallerFilename();

        // eslint-disable-next-line no-param-reassign
        meta.file = {
            column: columnNumber,
            line: lineNumber,
            name: fileName,
        };

        return meta;
    }
}

export default CallerProcessor;
