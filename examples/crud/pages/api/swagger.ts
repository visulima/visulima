import { swaggerApiRoute } from "@visulima/api-platform/next";

import { prisma } from "../../lib/prisma-client";

export default swaggerApiRoute({
    crud: {
        prismaClient: prisma,
    },
});
