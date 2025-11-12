import { stderr, stdout } from "node:process";

import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels, StreamAwareReporter } from "../../types";
import writeStream from "../../utils/write-stream";
import type { AbstractJsonReporterOptions } from "./abstract-json-reporter";
import { AbstractJsonReporter } from "./abstract-json-reporter";

/**
 * Server JSON Reporter.
 *
 * A JSON reporter for Node.js server environments that outputs structured log data
 * to stdout/stderr streams. Routes error-level logs to stderr and others to stdout.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   reporters: [new JsonReporter()]
 * });
 *
 * logger.info("Server started", { port: 3000 });
 * logger.error("Database connection failed", error);
 * ```
 */
class JsonReporter<L extends string = string> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    /** Standard output stream */
    #stdout: NodeJS.WriteStream;

    /** Standard error stream */
    #stderr: NodeJS.WriteStream;

    /**
     * Creates a new Server JSON Reporter instance.
     * @param options Configuration options for JSON formatting
     */
    public constructor(options: Partial<AbstractJsonReporterOptions> = {}) {
        super(options);

        this.#stdout = stdout;
        this.#stderr = stderr;
    }

    /**
     * Sets the stdout stream for the reporter.
     * @param stdout_ The writable stream to use for stdout output
     */
    public setStdout(stdout_: NodeJS.WriteStream): void {
        this.#stdout = stdout_;
    }

    /**
     * Sets the stderr stream for the reporter.
     * @param stderr_ The writable stream to use for stderr output
     */
    public setStderr(stderr_: NodeJS.WriteStream): void {
        this.#stderr = stderr_;
    }

    /**
     * Outputs the JSON message to the appropriate stream.
     *
     * Routes error and warning level messages to stderr, others to stdout.
     * @param message The JSON-formatted log message
     * @param logLevel The log level determining which stream to use
     * @protected
     */
    // eslint-disable-next-line no-underscore-dangle
    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const stream = ["error", "warn"].includes(logLevel as string) ? this.#stderr : this.#stdout;

        writeStream(`${message}\n`, stream);
    }
}

export default JsonReporter;
