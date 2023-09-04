import { handler } from "@visulima/api-platform/openapi";
import { modelsToOpenApi } from "@visulima/crud/openapi/adapter/prisma";

import { prisma } from "../../lib/prisma-client";

export default handler({
    allowedMediaTypes: {
        "application/json": true,
        "application/vnd.api+json": true,
        "application/x-yaml": true,
        "application/xml": true,
        "text/csv": true,
        "text/html": true,
        "text/xml": true,
    },
    specs: [modelsToOpenApi(prisma)],
});
