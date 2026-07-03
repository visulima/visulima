import type { File as UploadFile } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";
import express from "express";
import { AzureStorage } from "@visulima/storage/provider/azure";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new AzureStorage({
    containerName: "upload",
    accountName: "visulima",
    accountKey: "accountKey",
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
