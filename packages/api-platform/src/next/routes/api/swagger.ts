import { createNodeRouter } from "@visulima/connect";
// eslint-disable-next-line unicorn/prevent-abbreviations,import/no-extraneous-dependencies
import type { ModelsToOpenApiParameters } from "@visulima/crud";
import type { NextApiRequest, NextApiResponse } from "next";

import swaggerHandler from "../../../swagger/swagger-handler";

// eslint-disable-next-line max-len
const swaggerApiRoute = (
    options: Partial<{
        allowedMediaTypes: { [key: string]: boolean };
        swaggerFilePath: string;
        crud: Exclude<ModelsToOpenApiParameters, "swagger.allowedMediaTypes">;
    }> = {},
) => {
    const handler = swaggerHandler(options);

    const router = createNodeRouter<NextApiRequest, NextApiResponse>().get(handler);

    return router.handler();
};

export default swaggerApiRoute;
