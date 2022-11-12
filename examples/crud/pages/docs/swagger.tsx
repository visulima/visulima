import { getSwaggerStaticProps as getSwaggerStaticProperties, SwaggerPage } from "@visulima/api-platform/next";

import { prisma } from "../../lib/prisma-client";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`, {
    crud: {
        prismaClient: prisma,
    }
});

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
