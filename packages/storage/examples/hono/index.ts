import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import type { Context } from "hono";
import { DiskStorage } from "@visulima/storage";
import { createStorageHandler } from "@visulima/storage/handler/http/hono";
import { xhrOpenApiSpec, tusOpenApiSpec } from "@visulima/storage/openapi";
import { MediaTransformer } from "@visulima/storage/transformer";
import ImageTransformer from "@visulima/storage/transformers/image";
import { serve } from "@hono/node-server";

const app = new Hono();

// Middleware
app.use(
    "*",
    cors({
        origin: ["http://localhost:3000"],
        allowMethods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
);
app.use("*", logger());

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
    logger: console,
});

// Media transformer with only image support
const mediaTransformer = new MediaTransformer(storage, {
    ImageTransformer, // Only enable image transformations
    maxImageSize: 10 * 1024 * 1024, // 10MB for images
});

// Health check route (custom - not using OpenAPI utilities)
app.get("/health", (c: Context) => c.json({ status: "OK", runtime: "hono", method: "fetch" }));

// Register storage handlers - routes are automatically registered!
createStorageHandler(app, {
    path: "/files",
    storage,
    mediaTransformer,
    type: "multipart",
});

createStorageHandler(app, {
    path: "/files-rest",
    storage,
    mediaTransformer,
    type: "rest",
});

createStorageHandler(app, {
    path: "/files-tus",
    storage,
    mediaTransformer,
    type: "tus",
});

// Swagger UI route
app.get(
    "/",
    swaggerUI({
        url: "/openapi.json",
    }),
);

// OpenAPI JSON route - combines xhrOpenApiSpec and tusOpenApiSpec from @visulima/upload
app.get("/openapi.json", (c: Context) => {
    const xhrSpec = xhrOpenApiSpec("http://localhost:3000", "/files", {
        transformer: "image",
        supportedTransformerFormat: mediaTransformer.supportedFormats(),
    });
    const tusSpec = tusOpenApiSpec("/files-tus", {
        transformer: "image",
        supportedTransformerFormat: mediaTransformer.supportedFormats(),
    });

    return c.json({
        openapi: "3.0.0",
        info: {
            title: "Visulima Upload API",
            version: "1.0.0",
            description: "File upload API built with Hono and Visulima Upload (Multipart & TUS)",
            contact: {
                name: "Visulima",
                url: "https://github.com/visulima/visulima",
            },
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server",
            },
        ],
        components: {
            schemas: {
                ...xhrSpec.components?.schemas,
                ...tusSpec.components?.schemas,
            },
            examples: {
                ...xhrSpec.components?.examples,
                ...tusSpec.components?.examples,
            },
            responses: {
                ...xhrSpec.components?.responses,
                ...tusSpec.components?.responses,
            },
            parameters: {
                ...xhrSpec.components?.parameters,
                ...tusSpec.components?.parameters,
            },
        },
        paths: {
            ...xhrSpec.paths,
            ...tusSpec.paths,
        },
    });
});

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
