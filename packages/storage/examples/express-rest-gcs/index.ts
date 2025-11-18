import type { UploadFile } from "@visulima/storage";
import { Rest } from "@visulima/storage/handler/http/node";
import express from "express";
import { GCStorage } from "@visulima/storage/provider/gcs";
import Cors from "cors";

const PORT = process.env.PORT || 3003;

const app = express();

const storage = new GCStorage({
    maxUploadSize: "1GB",
    onComplete: (file) => {
        const { uri = "unknown", id } = file;

        // send gcs link to client
        return { id, link: uri };
    },
});

const rest = new Rest({ storage });

// Initializing the cors middleware
const cors = Cors({
    methods: ["POST", "PUT", "GET", "HEAD", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

// REST API endpoints for direct binary uploads
// Note: rest.handle will parse the raw body stream directly
app.post("/files", rest.handle, async (request, response, next) => {
    try {
        const file = (request as express.Request & { body: UploadFile }).body;

        return response.status(201).json(file);
    } catch (error) {
        return next(error);
    }
});

// PUT endpoint - Create or update file (requires ID in URL)
app.put("/files/:id", rest.handle, async (request, response, next) => {
    try {
        const file = (request as express.Request & { body: UploadFile }).body;

        return response.json(file);
    } catch (error) {
        return next(error);
    }
});

// GET endpoint - Retrieve file or list files
app.get("/files/:id?", rest.handle, async (request, response, next) => {
    try {
        // Handler will stream the file or return list
        // The handler manages the response directly, so we just call next
        return next();
    } catch (error) {
        return next(error);
    }
});

// HEAD endpoint - Get file metadata
app.head("/files/:id", rest.handle, async (request, response, next) => {
    try {
        // Handler will set headers
        // The handler manages the response directly, so we just call next
        return next();
    } catch (error) {
        return next(error);
    }
});

// DELETE endpoint - Delete single file or batch delete
app.delete("/files/:id?", rest.handle, async (request, response, next) => {
    try {
        // Single file delete: DELETE /files/:id
        // Batch delete: DELETE /files?ids=id1,id2,id3
        // Or: DELETE /files with JSON body: { "ids": ["id1", "id2"] }
        // The handler manages the response directly, so we just call next
        return next();
    } catch (error) {
        return next(error);
    }
});

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error("Error:", error);
    response.status(500).json({ error: error.message || "Internal server error" });
});

app.listen(PORT, () => {
    console.log("REST API server listening on port:", PORT);
    console.log("\nEndpoints:");
    console.log("  POST   /files              - Upload file (raw binary)");
    console.log("  PUT    /files/:id          - Create or update file");
    console.log("  GET    /files              - List all files");
    console.log("  GET    /files/:id          - Download file");
    console.log("  HEAD   /files/:id          - Get file metadata");
    console.log("  DELETE /files/:id          - Delete single file");
    console.log("  DELETE /files?ids=id1,id2  - Batch delete files");
    console.log("\nExample upload:");
    console.log("  curl -X POST http://localhost:" + PORT + "/files \\");
    console.log('    -H "Content-Type: image/jpeg" \\');
    console.log('    -H "Content-Disposition: attachment; filename=\\"photo.jpg\\"" \\');
    console.log("    --data-binary @/path/to/file.jpg");
});
