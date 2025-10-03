import { S3Client } from "@aws-sdk/client-s3";

import type { CreateTigrisClientParams as CreateTigrisClientParameters } from "./types";

/**
 * Create a Tigris client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY`
 * - `TIGRIS_ENDPOINT`
 */
const tigris = (parameters?: CreateTigrisClientParameters) => {
    const { accessKeyId, endpoint, secretAccessKey } = parameters ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.TIGRIS_ACCESS_KEY_ID || process.env.TIGRIS_ACCESS_KEY,
        endpoint: process.env.TIGRIS_ENDPOINT,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.TIGRIS_SECRET_ACCESS_KEY || process.env.TIGRIS_SECRET_KEY,
    };

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Tigris client.");
    }

    return new S3Client({
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://t3.storage.dev",
        forcePathStyle: false,
        region: "auto",
    });
};

export default tigris;
