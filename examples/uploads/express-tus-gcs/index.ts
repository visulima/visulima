import express from "express";
import type { UploadFile } from "../../../packages/upload";
import { Tus } from "../../../packages/upload";
import { GCStorage } from "@visulima/upload/gcs";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new GCStorage({
    maxUploadSize: "1GB",
    onComplete: ({ uri = "unknown", id }: { id : string, uri: string }) => {
        console.log(`File upload complete, storage path: ${uri}`);
        // send gcs link to client
        return { id, link: uri };
    },
});

const tus = new Tus({ storage });

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
