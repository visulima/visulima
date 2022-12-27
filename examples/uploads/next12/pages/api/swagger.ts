import { swaggerApiRoute } from "@visulima/api-platform/next";
import { multipartSwagger, tusSwagger } from "@visulima/uploads";

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
    specs: [
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/aws"),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/azure"),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/gcs"),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/local"),
        tusSwagger("/api/files/tus/aws"),
        tusSwagger("/api/files/tus/azure"),
        tusSwagger("/api/files/tus/gcs"),
        tusSwagger("/api/files/tus/local"),
    ]
});
