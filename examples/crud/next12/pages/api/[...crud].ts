// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import PrismaAdapter from "@visulima/crud/adapter/prisma";
import { nodeHandler } from "@visulima/crud/framework/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

const router = createNodeRouter<NextApiRequest, NextApiResponse>().all(async (request, response) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
});

export default router.handler();
