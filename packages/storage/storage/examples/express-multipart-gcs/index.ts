import type { UploadFile } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";
import express from "express";
import { GCStorage } from "@visulima/storage/provider/gcs";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new GCStorage({
    maxUploadSize: "1GB",
    onComplete: (file) => {
        const { uri = "unknown", id } = file;

        // send gcs link to client
        return { id, link: uri };
    },
});

const multipart = new Multipart({ storage });

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

app.use("/files", multipart.handle, (request, response) => {
    const file = (request as express.Request & { body: UploadFile }).body;

    return response.json(file);
});

app.listen(PORT, () => console.log("listening on port:", PORT));
