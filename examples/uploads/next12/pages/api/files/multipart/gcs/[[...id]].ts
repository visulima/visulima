import { nodeMultipartHandler } from "@visulima/upload/next";
import Cors from "cors";
import type { NextApiRequest, NextApiResponse } from "next";
import { GCStorage } from "@visulima/upload/gcs";

import runMiddleware from "../../../../../utils/middleware";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

const storage = new GCStorage({
    // to create a bucket in fake-gcs, you need to call before you run the docker-compose:
    // mkdir -p /data/fake-gcs/test-bucket
    bucket: "test-bucket",
    maxUploadSize: "1GB",
    logger: console,
    projectId: "test",
    storageAPI: "http://0.0.0.0:4443/storage/v1/b",
    uploadAPI: "http://0.0.0.0:4443/upload/storage/v1/b",
    expiration: { maxAge: "1h", purgeInterval: "15min" },
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
