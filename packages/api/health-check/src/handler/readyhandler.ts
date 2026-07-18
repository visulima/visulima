import type { IncomingMessage, ServerResponse } from "node:http";

import type { HealthCheck } from "../types";
import respond from "./respond";

// Inlined HTTP status codes to avoid pulling the `http-status-codes` runtime
// dependency into every consumer for two constants.
const HTTP_NO_CONTENT = 204;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Creates a framework-agnostic Node HTTP readiness probe handler. Only checkers
 * tagged `readiness` (the default for every checker) participate. Responds with
 * `204` when ready and `503` otherwise, with an empty body.
 */
const healthReadyHandler
    = <Request extends IncomingMessage, Response extends ServerResponse>(healthCheck: HealthCheck) =>
        async (_request: Request, response: Response): Promise<void> => {
            let statusCode: number;

            try {
                const { healthy } = await healthCheck.getReport("readiness");

                statusCode = healthy ? HTTP_NO_CONTENT : HTTP_SERVICE_UNAVAILABLE;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                statusCode = HTTP_SERVICE_UNAVAILABLE;
            }

            respond(response, { statusCode });
        };

export default healthReadyHandler;
