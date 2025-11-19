import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";
import path from "path";

const PORT = process.env.PORT || 3002;

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

// Multipart handler - single instance for all requests
const multipart = new Multipart({ storage });

// CORS configuration
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
};

function setCORSHeaders(res: ServerResponse): void {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
}

function sendJSONResponse(res: ServerResponse, data: any, status = 200): void {
    setCORSHeaders(res);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function sendErrorResponse(res: ServerResponse, error: string, status = 500): void {
    console.error("Request error:", error);
    sendJSONResponse(res, { error }, status);
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCORSHeaders(res);

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    const { pathname } = parse(req.url || "/");
    const method = req.method;

    try {
        // Route handling
        if (pathname === "/health" && method === "GET") {
            sendJSONResponse(res, {
                status: "OK",
                runtime: "node",
                method: "handle",
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            });
            return;
        }

        if (pathname === "/files" && method === "GET") {
            // Use the handle method directly for file listing
            await multipart.handle(req, res);
            return;
        }

        if (pathname === "/upload" && method === "POST") {
            // Use the handle method directly for uploads
            await multipart.handle(req, res);
            return;
        }

        // 404 for unknown routes
        sendJSONResponse(res, { error: "Not found" }, 404);
    } catch (error: any) {
        sendErrorResponse(res, error.message || "Internal server error");
    }
});

// Startup logging
server.listen(PORT, () => {
    console.log(`🚀 Node.js upload server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${path.join(process.cwd(), "uploads")}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
    console.log(`📋 File listing: http://localhost:${PORT}/files`);
});
