import express from "express";
import type { UploadFile } from "../../../packages/upload";
import { Multipart } from "../../../packages/upload";
import Cors from "cors";
import { S3Storage } from "@visulima/upload/aws";

const PORT = process.env.PORT || 3002;

const app = express();

// The credentials are loaded from a shared credentials file
const storage = new S3Storage({
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    expiration: { maxAge: "1h", purgeInterval: "15min" },
    onComplete: (file: UploadFile) => console.log("File upload complete: ", file),
});

const multipart = new Multipart({ storage })

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

app.use("/files", multipart.handle, (request, response) => {
    const file = request.body as UploadFile;

    console.log("File upload complete: ", file.originalName);

    return response.json(file);
});

app.listen(PORT, () => console.log("listening on port:", PORT));
