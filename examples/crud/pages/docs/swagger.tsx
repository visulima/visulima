import { getSwaggerStaticProps, SwaggerPage } from "@visulima/api-platform/next";

import { prisma } from "../../lib/prisma-client";

export const getStaticProps = getSwaggerStaticProps(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`, {
    crud: {
        prismaClient: prisma,
    }
});

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
