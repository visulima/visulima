import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import type { Context } from "hono";
import { Multipart, DiskStorage, Tus } from "@visulima/upload";
import { xhrOpenApiSpec, tusOpenApiSpec } from "@visulima/upload/openapi";
import { MediaTransformer } from "@visulima/upload/transformer";
import ImageTransformer from "@visulima/upload/transformers/image";
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

// Multipart handler
const multipart = new Multipart({
    storage,
    mediaTransformer,
});

// TUS handler for resumable uploads
const tus = new Tus({
    storage,
    mediaTransformer,
});

// Health check route (custom - not using OpenAPI utilities)
app.get("/health", (c: Context) => c.json({ status: "OK", runtime: "hono", method: "fetch" }));

// File upload route - uses multipart.fetch directly
app.post("/files", async (c: Context) => {
    const request = c.req.raw; // Get the Web API Request

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("Upload error:", error);
        return c.json({ error: error.message || "Upload failed" }, 500);
    }
});

// File listing route - uses multipart.fetch directly
app.get("/files/:id?/:metadata?", async (c: Context) => {
    const request = c.req.raw;

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("List files error:", error);
        return c.json({ error: error.message || "Failed to list files" }, 500);
    }
});

// File delete route - uses multipart.fetch directly
app.delete("/files/:id", async (c: Context) => {
    const request = c.req.raw;

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("Delete file(s) error:", error);
        return c.json({ error: error.message || "Failed to delete file(s)" }, 500);
    }
});

// TUS resumable upload routes
app.all("/files-tus", async (c: Context) => {
    const request = c.req.raw;

    try {
        return await tus.fetch(request);
    } catch (error: any) {
        console.error("TUS upload error:", error);
        return c.json({ error: error.message || "TUS upload failed" }, 500);
    }
});

app.all("/files-tus/:id", async (c: Context) => {
    const request = c.req.raw;

    try {
        return await tus.fetch(request);
    } catch (error: any) {
        console.error("TUS upload error:", error);
        return c.json({ error: error.message || "TUS upload failed" }, 500);
    }
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
