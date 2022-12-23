import type { SwaggerHandlerOptions } from "../../../../swagger/api/swagger-handler";
import swaggerHandler from "../../../../swagger/api/swagger-handler";

/**
 * @deprecated Use `import { swaggerHandler } from "@visulima/api-framework"` instead.
 */
const swaggerApiRoute = (
    options: Partial<SwaggerHandlerOptions> = {},
) => swaggerHandler(options);

export default swaggerApiRoute;
