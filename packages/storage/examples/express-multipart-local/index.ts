import express from "express";
import type { UploadFile } from "@visulima/upload";
import { DiskStorage, Multipart } from "@visulima/upload";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new DiskStorage({ directory: "upload" });

const multipart = new Multipart({ storage });

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

app.use("/files", multipart.handle, async (request, response, next) => {
    try {
        const file = request.body as UploadFile;

        console.log("File upload complete: ", file.originalName);

        return response.json(file);
    } catch (error) {
        return next(error);
    }
});

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error("File upload error:", error);

    return response.status(500).json({ error: "File upload failed" });
});

app.listen(PORT, () => console.log("listening on port:", PORT));
