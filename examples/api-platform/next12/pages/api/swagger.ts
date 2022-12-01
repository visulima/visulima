import { swaggerApiRoute } from "@visulima/api-platform/next";

export default swaggerApiRoute({
    allowedMediaTypes: {
        "application/json": true,
        "application/vnd.api+json": true,
        "application/x-yaml": true,
        "application/xml": true,
        "text/csv": true,
        "text/html": true,
        "text/xml": true,
    },
});
