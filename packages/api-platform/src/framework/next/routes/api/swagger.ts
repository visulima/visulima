import type { IncomingMessage, ServerResponse } from "node:http";

import type { SwaggerHandlerOptions } from "../../../../swagger/api/swagger-handler";
import swaggerHandler from "../../../../swagger/api/swagger-handler";

/**
 * @deprecated Use `import { swaggerHandler } from "@visulima/api-framework"` instead.
 */
const swaggerApiRoute = <M extends string, PrismaClient>(
    options: Partial<SwaggerHandlerOptions<M, PrismaClient>> = {},
): (request: IncomingMessage, response: ServerResponse) => Promise<void> => swaggerHandler(options);

export default swaggerApiRoute;
