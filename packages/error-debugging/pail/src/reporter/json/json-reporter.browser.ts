import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../../types";
import writeConsoleLogBasedOnLevel from "../../utils/write-console-log-based-on-level";
import type { AbstractJsonReporterOptions } from "./abstract-json-reporter";
import { AbstractJsonReporter } from "./abstract-json-reporter";

/**
 * Browser JSON Reporter.
 *
 * A JSON reporter for browser environments that outputs structured log data
 * to the browser console. Uses appropriate console methods based on log level.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   reporters: [new JsonReporter()]
 * });
 *
 * logger.info("Application started", { version: "1.0.0" });
 * // Outputs: {"level":"info","message":"Application started","context":[{"version":"1.0.0"}],...}
 * ```
 */
class JsonReporter<L extends string = string> extends AbstractJsonReporter<L> {
    /**
     * Creates a new Browser JSON Reporter instance.
     * @param options Configuration options for JSON formatting
     */
    public constructor(options: Partial<AbstractJsonReporterOptions> = {}) {
        super(options);
    }

    /**
     * Outputs the JSON message to the browser console.
     *
     * Uses the appropriate console method based on the log level
     * (console.log, console.error, console.warn, etc.).
     * @param message The JSON-formatted log message
     * @param logLevel The log level determining which console method to use
     * @protected
     */
    // eslint-disable-next-line class-methods-use-this, no-underscore-dangle
    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const consoleLogFunction = writeConsoleLogBasedOnLevel(logLevel);

        consoleLogFunction(message);
    }
}

export default JsonReporter;
