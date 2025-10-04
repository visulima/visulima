import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { Multipart, DiskStorage } from "@visulima/upload";
import { promises as fs } from "fs";
import path from "path";

const PORT = process.env.PORT || 3002;

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

// Multipart handler
const multipart = new Multipart({ storage });

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    const { pathname } = parse(req.url || "/");

    try {
        switch (pathname) {
            case "/health":
                if (req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: "OK", runtime: "node" }));
                } else {
                    res.writeHead(405);
                    res.end("Method not allowed");
                }
                break;

            case "/files":
                if (req.method === "GET") {
                    await handleListFiles(req, res);
                } else {
                    res.writeHead(405);
                    res.end("Method not allowed");
                }
                break;

            case "/upload":
                if (req.method === "POST") {
                    await multipart.handle(req, res);
                } else {
                    res.writeHead(405);
                    res.end("Method not allowed");
                }
                break;

            default:
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Not found" }));
        }
    } catch (error: any) {
        console.error("Server error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
});

async function handleListFiles(req: IncomingMessage, res: ServerResponse) {
    try {
        const uploadsDir = path.join(process.cwd(), "uploads");

        // Check if uploads directory exists
        try {
            await fs.access(uploadsDir);
        } catch {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ files: [] }));
            return;
        }

        // Read directory contents
        const files = await fs.readdir(uploadsDir);
        const fileStats = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(uploadsDir, file);
                const stats = await fs.stat(filePath);

                if (stats.isFile()) {
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime,
                    };
                }
                return null;
            }),
        );

        const validFiles = fileStats.filter(Boolean);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ files: validFiles }));
    } catch (error: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

server.listen(PORT, () => {
    console.log(`🚀 Node.js upload server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${path.join(process.cwd(), "uploads")}`);
});
