// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { corsMiddleware, createNodeRouter } from "@visulima/api-platform";
import { z } from "zod";

const schema = z.object({});

/**
 * @openapi
 * /api/cors:
 *   get:
 *     tags:
 *       - "root"
 *     description: "Return a cors headers."
 *     operationId: "cors"
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
const router = createNodeRouter<NextApiRequest, NextApiResponse>()
    .use(corsMiddleware())
    .get(async (request, response) => {
        response.status(200).json({});
    }, schema);

export default router.handler();
