import type { UploadFile } from "@visulima/storage";
import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";
import express from "express";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

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
        const file = (request as express.Request & { body: UploadFile }).body;

        return response.json(file);
    } catch (error) {
        return next(error);
    }
});

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error("Error:", error);
    response.status(500).json({ error: error.message || "Internal server error" });
});

app.listen(PORT, () => console.log("listening on port:", PORT));
