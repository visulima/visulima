import type { NextApiRequest, NextApiResponse } from "next";

/**
 * @openapi
 * /api/health/live:
 *   get:
 *     tags:
 *       - "health"
 *     description: "Returns the liveness of a microservice"
 *     operationId: "health-check-live"
 *     responses:
 *       200:
 *         description: "Successful operation"
 */
export default (_request: NextApiRequest, response: NextApiResponse) => {
    response.status(200);
    response.end();
};
