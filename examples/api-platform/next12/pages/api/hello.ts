// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import { z } from "zod";

type Data = {
    name: string;
};

const schema = z.object({
    query: z.object({
        name: z.string().optional(),
    }),
});

/**
 * @openapi
 * /api/hello:
 *   get:
 *     tags:
 *       - "root"
 *     description: "Return a greeting."
 *     operationId: "hello"
 *     parameters:
 *       - name: name
 *         in: query
 *         required: false
 *         explode: true
 *         schema:
 *            type: string
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
const router = createNodeRouter<NextApiRequest, NextApiResponse<Data>>().get(async (request, response) => {
    response.status(200).json({ name: (request.query?.name as string) || "John Doe" });
}, schema);

export default router.handler();
