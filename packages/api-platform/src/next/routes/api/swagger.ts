import { createNodeRouter } from "@visulima/connect";
// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import type { NextApiRequest, NextApiResponse } from "next";

import swaggerHandler, { SwaggerHandlerOptions } from "../../../swagger/swagger-handler";

// eslint-disable-next-line max-len
const swaggerApiRoute = (
    options: Partial<SwaggerHandlerOptions> = {},
) => {
    const handler = swaggerHandler(options);

    const router = createNodeRouter<NextApiRequest, NextApiResponse>().get(handler);

    return router.handler();
};

export default swaggerApiRoute;
