import type { UploadFile } from "@visulima/storage";
import { Tus } from "@visulima/storage/handler/http/node";
import express from "express";
import { GCStorage } from "@visulima/storage/provider/gcs";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new GCStorage({
    maxUploadSize: "1GB",
    onComplete: ({ uri = "unknown", id }: { id: string; uri: string }) => {
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

// TUS handler manages the response directly
app.use("/files", tus.handle);

app.listen(PORT, () => console.log("listening on port:", PORT));
