// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { corsMiddleware, createRouter } from "@visulima/api-platform"
import { z } from "zod";


const schema = z.object({})

export const swagger = {};

/**
 * @openapi
 * /api/cors:
 *   get:
 *     tags:
 *       - "root"
 *     description: "Return a greeting."
 *     operationId: "hello"
 *     parameters:
 *       - name: name
 *         in: query
 *     responses:
 *       200:
 *         description: "Successful operation"
 *         content:
 *           application/json:
 *             schema:
 *               type: "object"
 *               properties:
 *                 name:
 *                   type: string
 */
const router = createRouter<NextApiRequest, NextApiResponse>().use(corsMiddleware()).get(async (request, response) => {
    response.status(200).json({});
}, schema);

export default router.handler();
