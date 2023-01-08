import { nodeMultipartHandler } from "@visulima/upload/next";
import Cors from "cors";
import type { NextApiRequest, NextApiResponse } from "next";
import { AzureStorage } from "@visulima/upload/azure";

import runMiddleware from "../../../../../utils/middleware";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

const storage = new AzureStorage({
    containerName: "upload",
    connectionString: "DefaultEndpointsProtocol=http;AccountName=account1;AccountKey=key1;BlobEndpoint=http://account1.blob.localhost:10000;QueueEndpoint=http://account1.queue.localhost:10001;TableEndpoint=http://account1.table.localhost:10002;",
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

    return nodeMultipartHandler({ storage })(request, response);
}
