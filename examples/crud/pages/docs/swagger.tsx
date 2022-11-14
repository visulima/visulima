import { getSwaggerStaticProps as getSwaggerStaticProperties, SwaggerPage } from "@visulima/api-platform/next";

import { prisma } from "../../lib/prisma-client";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`, {
    crud: {
        prismaClient: prisma,
        swagger: {
            allowedMediaTypes: {
                "application/json": true,
                "application/vnd.api+json": true,
                "application/x-yaml": true,
                "application/xml": true,
                "text/csv": true,
                "text/html": true,
                "text/xml": true,
            },
        },
    },
});

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
