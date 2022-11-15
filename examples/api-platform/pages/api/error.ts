// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter, createHttpError } from "@visulima/api-platform";
import { z } from "zod";

type Data = {
    errorType: string | "server_error" | "not_found_error";
};

const schema = z.object({
    query: z.object({
        errorType: z.string().optional().default("server_error"),
    }),
});

/**
 * @openapi
 * /api/error:
 *   get:
 *     tags:
 *       - "error"
 *     description: "Returns a error message."
 *     operationId: "error"
 *     parameters:
 *       - name: errorType
 *         in: query
 *         required: false
 *         explode: true
 *         schema:
 *            type: string
 *            enum: [server_error, not_found_error]
 *     responses:
 *       404:
 *         description: "Successful operation"
 *       500:
 *         description: "Successful operation"
 */
const router = createNodeRouter<NextApiRequest, NextApiResponse<Data>>().get(async (request, response) => {
    const errorType = request.query?.errorType as Data["errorType"];

    if (errorType === "server_error") {
        throw new Error("Server error.");
    }

    if (errorType === "not_found_error") {
        throw createHttpError(404, "Not found error.");
    }
}, schema);

export default router.handler();
