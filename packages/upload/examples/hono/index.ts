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
    try {
        // Convert Hono request to Node.js compatible format
        const nodeReq = {
            headers: Object.fromEntries(c.req.raw.headers.entries()),
            method: c.req.method,
            url: c.req.url,
            pipe: () => {},
            on: () => {},
            once: () => {},
            removeListener: () => {},
            setEncoding: () => {},
            destroy: () => {},
            _originalRequest: c.req.raw,
        } as any as import("http").IncomingMessage;

        const nodeRes = {
            writeHead: (status: number, headers?: Record<string, string | string[]>) => {
                c.status(status);
                if (headers) {
                    Object.entries(headers).forEach(([key, value]) => {
                        c.header(key, Array.isArray(value) ? value.join(", ") : value);
                    });
                }
            },
            setHeader: (name: string, value: string | string[]) => {
                c.header(name, Array.isArray(value) ? value.join(", ") : value);
            },
            getHeader: (name: string) => c.res.headers.get(name),
            removeHeader: (name: string) => c.res.headers.delete(name),
            write: (data: any) => {
                // In Hono, we handle response data differently
            },
            end: (data?: any) => {
                if (data) {
                    return c.json(data);
                }
                return c.json({ message: "Upload completed" });
            },
            statusCode: 200,
            headersSent: false,
            writeContinue: () => {},
            writeEarlyHints: () => {},
            flushHeaders: () => {
                this.headersSent = true;
            },
        } as any as import("http").ServerResponse;

        await multipart.handle(nodeReq, nodeRes);

        // The response is already sent by the multipart handler
        return c.res;
    } catch (error: any) {
        console.error("Upload error:", error);
        return c.json({ error: error.message }, 500);
    }
});

// Health check
app.get("/health", (c) => c.json({ status: "OK", runtime: "hono" }));

// List uploaded files
app.get("/files", (c) => {
    try {
        const fs = require("fs");
        const path = require("path");

        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
            return c.json({ files: [] });
        }

        const files = fs
            .readdirSync(uploadsDir)
            .filter((file: string) => fs.statSync(path.join(uploadsDir, file)).isFile())
            .map((file: string) => {
                const stats = fs.statSync(path.join(uploadsDir, file));
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                };
            });

        return c.json({ files });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default app;
