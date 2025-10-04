import { Multipart, DiskStorage } from "@visulima/upload";

const PORT = parseInt(process.env.PORT || "3002");

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

// Multipart handler
const multipart = new Multipart({ storage });

async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        switch (url.pathname) {
            case "/health":
                if (request.method === "GET") {
                    return new Response(JSON.stringify({ status: "OK", runtime: "bun" }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
                break;

            case "/files":
                if (request.method === "GET") {
                    return await handleListFiles(corsHeaders);
                }
                break;

            case "/upload":
                if (request.method === "POST") {
                    return await handleUpload(request, corsHeaders);
                }
                break;
        }

        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Request error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

async function handleListFiles(corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const uploadsDir = "./uploads";

        // Check if uploads directory exists
        try {
            await Bun.file(uploadsDir).exists();
        } catch {
            return new Response(JSON.stringify({ files: [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Read directory contents
        const files: any[] = [];
        const dir = Bun.file(uploadsDir);

        // For directory reading in Bun, we need to use Node.js APIs or alternative methods
        const fs = require("fs").promises;
        const path = require("path");
        const fullPath = path.resolve(uploadsDir);

        const entries = await fs.readdir(fullPath);
        for (const entry of entries) {
            const entryPath = path.join(fullPath, entry);
            const stats = await fs.stat(entryPath);

            if (stats.isFile()) {
                files.push({
                    name: entry,
                    size: stats.size,
                    modified: stats.mtime,
                });
            }
        }

        return new Response(JSON.stringify({ files }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

async function handleUpload(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        // Use the fetch multipart handler
        const { fetchMultipartHandler } = await import("@visulima/upload/fetch");

        const handler = fetchMultipartHandler({ storage });
        return await handler(request);
    } catch (error: any) {
        console.error("Upload error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

console.log(`🚀 Bun upload server running on http://localhost:${PORT}`);
console.log(`📁 Upload directory: ${process.cwd()}/uploads`);

Bun.serve({
    port: PORT,
    fetch: handleRequest,
});
