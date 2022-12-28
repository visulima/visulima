import { swaggerApiRoute } from "@visulima/api-platform/next";
import { multipartSwagger, tusSwagger } from "../../../../../packages/upload";

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
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/aws", ["Multipart AWS"]),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/azure", ["Multipart Azure"]),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/gcs", ["Multipart GCS"]),
        multipartSwagger(process.env.NEXT_PUBLIC_APP_ORIGIN as string, "/api/files/multipart/local", ["Multipart Local"]),
        tusSwagger("/api/files/tus/aws", ["Tus AWS"]),
        tusSwagger("/api/files/tus/azure", ["Tus Azure"]),
        tusSwagger("/api/files/tus/gcs", ["Tus GCS"]),
        tusSwagger("/api/files/tus/local", ["Tus Local"]),
    ]
});
