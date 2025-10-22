import type { Meta, Processor } from "../../types";
import getCallerFilename from "./get-caller-filename";

/**
 * Global namespace extension for caller file metadata.
 *
 * Extends the VisulimaPail.CustomMeta interface to include file information
 * that will be added by the CallerProcessor.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace VisulimaPail {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interface CustomMeta<L> {
            /** File information where the log was called from */
            file:
                | {
                    /** Column number in the source file */
                    column: number | undefined;
                    /** Line number in the source file */
                    line: number | undefined;
                    /** Name/path of the source file */
                    name: string | undefined;
                }
                | undefined;
        }
    }
}

/**
 * Caller Processor.
 *
 * A processor that adds file location information to log metadata.
 * Uses stack trace analysis to determine the file, line, and column
 * where the log call originated from.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import CallerProcessor from "@visulima/pail/processor/caller";
 *
 * const logger = createPail({
 *   processors: [new CallerProcessor()]
 * });
 *
 * logger.info("This log will include file location info");
 * // Result includes: file: { name: "...", line: 123, column: 45 }
 * ```
 */
class CallerProcessor<L extends string = string> implements Processor<L> {
    /**
     * Processes log metadata to add caller file information.
     *
     * Analyzes the call stack to determine the file location where the log
     * was called from and adds this information to the metadata.
     * @param meta The log metadata to process
     * @returns The processed metadata with file location information added
     */
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
