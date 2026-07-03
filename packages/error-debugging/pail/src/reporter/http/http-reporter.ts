import type { AbstractHttpReporterOptions } from "./abstract-http-reporter";
import { AbstractHttpReporter } from "./abstract-http-reporter";

/**
 * HTTP Reporter.
 *
 * A reporter that sends logs to HTTP endpoints.
 * Supports batching, compression, retries, and rate limiting.
 * Works in both Node.js server and browser environments.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import { HttpReporter } from "@visulima/pail/reporter/http";
 *
 * const logger = createPail({
 *   reporters: [
 *     new HttpReporter({
 *       url: "https://api.example.com/logs",
 *       method: "POST",
 *       headers: {
 *         "Authorization": "Bearer token"
 *       },
 *       enableBatchSend: true,
 *       batchSize: 100
 *     })
 *   ]
 * });
 *
 * logger.info("Application started", { version: "1.0.0" });
 * ```
 */
class HttpReporter<L extends string = string> extends AbstractHttpReporter<L> {
    /**
     * Creates a new HTTP Reporter instance.
     * @param options Configuration options for HTTP reporting
     */
    public constructor(options: AbstractHttpReporterOptions) {
        super(options);
    }
}

export default HttpReporter;
