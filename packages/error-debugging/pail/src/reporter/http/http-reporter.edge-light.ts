import type { AbstractHttpReporterOptions } from "./abstract-http-reporter";
import { AbstractHttpReporter } from "./abstract-http-reporter";

/**
 * HTTP Reporter for Edge Runtime environments.
 *
 * A reporter optimized for Edge Runtime environments (Next.js Edge, Cloudflare Workers, etc.)
 * that sends logs to HTTP endpoints. Edge compatibility mode is enabled by default.
 * Supports batching, retries, and rate limiting. Compression is disabled for Edge compatibility.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import { HttpReporterEdgeLight } from "@visulima/pail/reporter/http/edge-light";
 *
 * const logger = createPail({
 *   reporters: [
 *     new HttpReporterEdgeLight({
 *       url: "https://api.example.com/logs",
 *       method: "POST",
 *       headers: {
 *         "Authorization": "Bearer token"
 *       },
 *       enableBatchSend: true,
 *       batchSize: 50
 *     })
 *   ]
 * });
 *
 * logger.info("Edge function started");
 * ```
 */
class HttpReporterEdgeLight<L extends string = string> extends AbstractHttpReporter<L> {
    /**
     * Creates a new HTTP Reporter Edge Light instance.
     * Edge compatibility mode is automatically enabled.
     * @param options Configuration options for HTTP reporting
     */
    public constructor(options: Omit<AbstractHttpReporterOptions, "edgeCompat">) {
        super({
            ...options,
            edgeCompat: true,
        });
    }
}

export default HttpReporterEdgeLight;
