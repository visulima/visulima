import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Multipart, DiskStorage } from "@visulima/upload";

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

// Routes
app.post("/upload", async (c) => {
    const request = c.req.raw; // Get the Web API Request

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("Upload error:", error);
        return c.json({ error: error.message || "Upload failed" }, 500);
    }
});

// File listing using fetch method
app.get("/files", async (c) => {
    const request = c.req.raw;

    try {
        return await multipart.fetch(request);
    } catch (error: any) {
        console.error("List files error:", error);
        return c.json({ error: error.message || "Failed to list files" }, 500);
    }
});

// Health check
app.get("/health", (c) => c.json({ status: "OK", runtime: "hono", method: "fetch" }));

export default app;
