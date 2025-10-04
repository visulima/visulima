import { S3Client } from "@aws-sdk/client-s3";

import type { CreateDigitalOceanClientParams as CreateDigitalOceanClientParameters } from "./types";

/**
 * Create a DigitalOcean Spaces client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `SPACES_REGION`
 * - `SPACES_KEY`
 * - `SPACES_SECRET`
 */
const digitalOcean = (parameters?: CreateDigitalOceanClientParameters) => {
    const { key, region, secret } = parameters ?? {
        key: process.env.AWS_ACCESS_KEY_ID || process.env.SPACES_KEY,
        region: process.env.AWS_REGION || process.env.SPACES_REGION,
        secret: process.env.AWS_SECRET_ACCESS_KEY || process.env.SPACES_SECRET,
    };

    if (!region || !key || !secret) {
        throw new Error("Missing required parameters for DigitalOcean Spaces client.");
    }

    return new S3Client({
        credentials: {
            accessKeyId: key,
            secretAccessKey: secret,
        },
        endpoint: `https://${region}.digitaloceanspaces.com`,
        forcePathStyle: false,
        region: "us-east-1",
    });
};

export default digitalOcean;
