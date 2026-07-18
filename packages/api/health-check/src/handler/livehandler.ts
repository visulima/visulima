import type { IncomingMessage, ServerResponse } from "node:http";

import type { HealthCheck } from "../types";

// Inlined HTTP status codes to avoid pulling the `http-status-codes` runtime
// dependency into every consumer for two constants.
const HTTP_NO_CONTENT = 204;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Creates a framework-agnostic Node HTTP liveness probe handler. Only checkers
 * tagged `liveness` (the default for every checker) participate. Responds with
 * `204` when live and `503` otherwise, with an empty body.
 *
 * Liveness should signal whether the process is alive (not deadlocked), so
 * keep liveness-tagged checkers cheap and independent of downstream readiness.
 */
const healthLiveHandler
    = <Request extends IncomingMessage, Response extends ServerResponse>(healthCheck: HealthCheck) =>
        async (_request: Request, response: Response): Promise<void> => {
            try {
                const { healthy } = await healthCheck.getReport("liveness");

                response.statusCode = healthy ? HTTP_NO_CONTENT : HTTP_SERVICE_UNAVAILABLE;
            } catch {
                response.statusCode = HTTP_SERVICE_UNAVAILABLE;
            }

            response.end();
        };

export default healthLiveHandler;
