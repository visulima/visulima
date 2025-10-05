import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import type { Context } from "hono";
import { Multipart, DiskStorage } from "@visulima/upload";
import { xhrOpenApiSepc } from "@visulima/upload/openapi";
import { serve } from '@hono/node-server'

const app = new Hono();

// Middleware
app.use(
    "*",
    cors({
        origin: ["http://localhost:3000"],
        allowMethods: ["POST", "GET", "OPTIONS"],
    }),
);
app.use("*", logger());

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

// Multipart handler
const multipart = new Multipart({ storage });

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
app.get("/files", async (c: Context) => {
    const request = c.req.raw;

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("List files error:", error);
        return c.json({ error: error.message || "Failed to list files" }, 500);
    }
});

// Swagger UI route
app.get("/", swaggerUI({
    url: "/openapi.json",
}));

// OpenAPI JSON route - uses the xhrOpenApiSepc from @visulima/upload
app.get("/openapi.json", (c: Context) => c.json({
    openapi: "3.0.0",
    info: {
        title: "Visulima Upload API",
        version: "1.0.0",
        description: "File upload API built with Hono and Visulima Upload",
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
    ...xhrOpenApiSepc("http://localhost:3000", "/files", ["Upload"]),
}));

serve({
    fetch: app.fetch,
    port: 3000
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })