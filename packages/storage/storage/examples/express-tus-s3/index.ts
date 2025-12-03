import type { UploadFile } from "@visulima/storage";
import { Tus } from "@visulima/storage/handler/http/node";
import express from "express";
import Cors from "cors";
import { S3Storage } from "@visulima/storage/provider/aws";

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new S3Storage({
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    expiration: { maxAge: "1h", purgeInterval: "15min" },
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
