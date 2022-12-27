import { nodeTusHandler } from "@visulima/uploads/next";
import Cors from "cors";
import type { NextApiRequest, NextApiResponse } from "next";
import { GCStorage } from "@visulima/uploads/gcs";

import runMiddleware from "../../../../../utils/middleware";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

const storage = new GCStorage({
    maxUploadSize: "1GB",
    logger: console,
});

export const config = {
    api: {
        bodyParser: false,
        responseLimit: "8mb",
        externalResolver: true,
    },
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    await runMiddleware(request, response, cors);

    return nodeTusHandler({ storage })(request, response);
}
