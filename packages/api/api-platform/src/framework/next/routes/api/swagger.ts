import type { SwaggerHandlerOptions } from "../../../../swagger/api/swagger-handler";
import swaggerHandler from "../../../../swagger/api/swagger-handler";

/**
 * @deprecated Use `import { swaggerHandler } from "@visulima/api-platform"` instead.
 */

const swaggerApiRoute: <M extends string, PrismaClient>(options: Partial<SwaggerHandlerOptions<M, PrismaClient>>) => void = (options) =>
    swaggerHandler(options);

// eslint-disable-next-line sonarjs/deprecation -- intentional self-reference: re-exports the deprecated alias for backwards compatibility
export default swaggerApiRoute;
