import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/fetch";

const PORT = parseInt(process.env.PORT || "3002");

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

function createCORSResponse(): Response {
    return new Response(null, { headers: corsHeaders });
}

function createJSONResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

function createErrorResponse(error: string, status = 500): Response {
    console.error("Request error:", error);
    return createJSONResponse({ error }, status);
}

async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Handle preflight requests
    if (method === "OPTIONS") {
        return createCORSResponse();
    }

    try {
        // Route handling
        if (url.pathname === "/health" && method === "GET") {
            return createJSONResponse({
                status: "OK",
                runtime: "bun",
                method: "fetch",
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            });
        }

        if (url.pathname === "/files" && method === "GET") {
            // Use the fetch method for file listing
            return await multipart.fetch(request);
        }

        if (url.pathname === "/upload" && method === "POST") {
            // Use the fetch method for uploads
            return await multipart.fetch(request);
        }

        // 404 for unknown routes
        return createJSONResponse({ error: "Not found" }, 404);
    } catch (error: any) {
        return createErrorResponse(error.message || "Internal server error");
    }
}

// Startup logging
console.log(`🚀 Bun upload server running on http://localhost:${PORT}`);
console.log(`📁 Upload directory: ${process.cwd()}/uploads`);
console.log(`🔗 Health check: http://localhost:${PORT}/health`);
console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
console.log(`📋 File listing: http://localhost:${PORT}/files`);

// Start the server
Bun.serve({
    port: PORT,
    fetch: handleRequest,
});
