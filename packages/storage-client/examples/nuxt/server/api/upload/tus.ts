import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskStorage } from "@visulima/storage";
import { Tus } from "@visulima/storage/handler/http/node";

// Initialize storage and TUS handler
const uploadDirectory = join(tmpdir(), "visulima-uploads");
const storage = new DiskStorage({ directory: uploadDirectory });
const tus = new Tus({ storage });

export default defineEventHandler(async (event) => {
    // Set CORS headers for TUS
    event.node.res.setHeader("Access-Control-Allow-Origin", "*");
    event.node.res.setHeader("Access-Control-Allow-Methods", "POST, PATCH, HEAD, OPTIONS");
    event.node.res.setHeader("Access-Control-Allow-Headers", "Content-Type, Upload-Offset, Upload-Length, Tus-Resumable");
    
    // Use the Node.js handler directly with IncomingMessage and ServerResponse
    await tus.handle(event.node.req, event.node.res);
});

