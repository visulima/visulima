import { healthLiveHandler } from "@visulima/health-check";

import HealthCheckService from "../../../integrations/healt-check";

/**
 * @openapi
 * /api/health/live:
 *   get:
 *     tags:
 *       - "health"
 *     description: "Returns the liveness of a microservice"
 *     operationId: "health-check-live"
 *     responses:
 *       204:
 *         description: "Successful operation"
 *       503:
 *         description: "Service unavailable"
 */
export default healthLiveHandler(HealthCheckService);
