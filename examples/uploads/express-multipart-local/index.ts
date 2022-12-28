import express from "express";
import type { UploadFile } from "../../../packages/upload";
import { DiskStorage, Multipart } from "../../../packages/upload";
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

app.use("/files", multipart.handle, (request, response) => {
    const file = request.body as UploadFile;

    console.log("File upload complete: ", file.originalName);

    return response.json(file);
});

app.listen(PORT, () => console.log("listening on port:", PORT));
