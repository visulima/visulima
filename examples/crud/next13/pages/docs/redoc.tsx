import { getSwaggerStaticProps as getSwaggerStaticProperties } from "../../../../../packages/api-platform/framework/next";
import RedocPage from "@visulima/api-platform/next/pages/redoc";

import { prisma } from "../../lib/prisma-client";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`, {
    crud: {
        prismaClient: prisma,
    },
});

export default RedocPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
