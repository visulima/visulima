import { nodeMultipartHandler } from "@visulima/upload/next";
import { DiskStorage } from "@visulima/upload";
import Cors from "cors";
import runMiddleware from "../../../../../utils/middleware";
import type { NextApiRequest, NextApiResponse } from "next";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

const storage = new DiskStorage({ directory: "upload", logger: console });

export const config = {
    api: {
        bodyParser: false,
        responseLimit: "8mb",
        externalResolver: true,
    },
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    await runMiddleware(request, response, cors);

    return nodeMultipartHandler({ storage })(request, response);
}
