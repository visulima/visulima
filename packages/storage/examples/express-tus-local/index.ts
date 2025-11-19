import type { UploadFile } from "@visulima/storage";
import { DiskStorage } from "@visulima/storage";
import { Tus } from "@visulima/storage/handler/http/node";
import express from "express";
import Cors from "cors";

const PORT = process.env.PORT || 3002;

const app = express();

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
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
