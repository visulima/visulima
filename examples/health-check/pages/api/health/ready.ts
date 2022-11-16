import { healthReadyHandler } from "@visulima/health-check";

import HealthCheckService from "../../../integrations/healt-check";

/**
 * @openapi
 * /api/health/ready:
 *   get:
 *     tags:
 *       - "health"
 *     description: "Returns the readiness state to accept incoming requests from the gateway or the upstream proxy."
 *     operationId: "health-check-ready"
 *     responses:
 *       204:
 *         description: "Successful operation"
 *       503:
 *         description: "Service unavailable"
 */
export default healthReadyHandler(HealthCheckService);
