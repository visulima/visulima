import { healthCheckHandler } from "@visulima/health-check";

import HealthCheckService from "../../../integrations/healt-check";

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - "health"
 *     description: "Return health checks."
 *     operationId: "healthcheck"
 *     responses:
 *       200:
 *         description: "Successful operation"
 *         content:
 *           application/json:
 *             schema:
 *               type: "object"
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 appName:
 *                   type: string
 *                 appVersion:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 reports:
 *                   type: object
 *                   properties:
 *                    checker-name:
 *                      type: object
 *                      properties:
 *                        displayName:
 *                          type: string
 *                        health:
 *                          type: object
 *                          properties:
 *                            healthy:
 *                              type: boolean
 *                            message:
 *                              type: string
 *                        meta:
 *                          oneOf:
 *                            - type: object
 *                            - type: string
 *                            - type: number
 *                            - type: array
 */
export default healthCheckHandler(HealthCheckService);
