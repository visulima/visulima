import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";

// Initialize storage and multipart handler
const uploadDirectory = join(tmpdir(), "visulima-uploads");
const storage = new DiskStorage({ directory: uploadDirectory });
const multipart = new Multipart({ storage });

export default defineEventHandler(async (event) => {
    // Set CORS headers
    event.node.res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Use the Node.js handler directly with IncomingMessage and ServerResponse
    await multipart.handle(event.node.req, event.node.res);
});

