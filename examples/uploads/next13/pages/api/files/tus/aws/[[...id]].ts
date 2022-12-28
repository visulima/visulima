import { nodeTusHandler } from "@visulima/upload/next";
import type { UploadFile } from "../../../../../../../../packages/upload";
import Cors from "cors";
import { S3Storage } from "@visulima/upload/aws";
import type { NextApiRequest, NextApiResponse } from "next";

import runMiddleware from "../../../../../utils/middleware";

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

// The credentials are loaded from a shared credentials file
const storage = new S3Storage({
    // to create a bucket in localstack, you need to call:
    // aws --endpoint-url=http://localhost:4566 s3 mb s3://my-test-bucket
    bucket: "my-test-bucket",
    endpoint: "http://localhost:4566",
    forcePathStyle: true,
    expiration: { maxAge: "1h", purgeInterval: "15min" },
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
