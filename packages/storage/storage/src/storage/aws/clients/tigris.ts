import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateTigrisClientParameters } from "./types";

/**
 * Create a Tigris client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY`
 * - `TIGRIS_ENDPOINT`
 */
const tigris = (parameters?: CreateTigrisClientParameters): S3ClientConfig => {
    const { accessKeyId, endpoint, secretAccessKey } = parameters ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.TIGRIS_ACCESS_KEY_ID || process.env.TIGRIS_ACCESS_KEY,
        endpoint: process.env.TIGRIS_ENDPOINT,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.TIGRIS_SECRET_ACCESS_KEY || process.env.TIGRIS_SECRET_KEY,
    };

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Tigris client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://t3.storage.dev",
        forcePathStyle: false,
        region: "auto",
    };
};

export default tigris;
