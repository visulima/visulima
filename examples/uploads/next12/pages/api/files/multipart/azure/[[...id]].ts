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
    connectionString: "AzureWebJobsStorage=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://0.0.0.0:10000/devstoreaccount1;QueueEndpoint=http://0.0.0.0:10001/devstoreaccount1;",
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
