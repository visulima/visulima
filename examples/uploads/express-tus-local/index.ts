import express from "express";
import type { UploadFile } from "@visulima/uploads";
import { DiskStorage, Tus } from "@visulima/uploads";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();
const uploadDirectory = "upload";

const storage = new DiskStorage({ directory: uploadDirectory });

const tus = new Tus({
    allowMIME: ["image/*", "video/*"],
    storage,
});

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

app.use("/files", tus.handle, (request, response) => {
    const file = request.body as UploadFile;

    console.log("File upload complete: ", file.originalName);

    return response.json(file);
});

app.listen(PORT, () => console.log("listening on port:", PORT));
