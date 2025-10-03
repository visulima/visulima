import { Multipart, DiskStorage } from "npm:@visulima/upload";

const PORT = parseInt(Deno.env.get("PORT") || "3002");

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
                    return new Response(JSON.stringify({ status: "OK", runtime: "deno" }), {
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
            await Deno.stat(uploadsDir);
        } catch {
            return new Response(JSON.stringify({ files: [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Read directory contents
        const files: any[] = [];
        for await (const entry of Deno.readDir(uploadsDir)) {
            if (entry.isFile) {
                const filePath = `${uploadsDir}/${entry.name}`;
                const stats = await Deno.stat(filePath);
                files.push({
                    name: entry.name,
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
        const { fetchMultipartHandler } = await import("npm:@visulima/upload/fetch");

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

console.log(`🚀 Deno upload server running on http://localhost:${PORT}`);
console.log(`📁 Upload directory: ${Deno.cwd()}/uploads`);

Deno.serve({ port: PORT }, handleRequest);
