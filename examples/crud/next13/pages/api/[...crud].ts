// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import PrismaAdapter from "@visulima/crud/adapter/prisma";
import { nodeHandler } from "@visulima/crud/framework/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

export default async (request: NextApiRequest, response: NextApiResponse) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
};
