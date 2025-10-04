import { S3Client } from "@aws-sdk/client-s3";

import type { CreateCloudflareClientParams as CreateCloudflareClientParameters } from "./types";

/**
 * Create a Cloudflare R2 client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `CLOUDFLARE_ACCOUNT_ID`
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY`
 * - `CLOUDFLARE_JURISDICTION`
 */
export const cloudflare = (parameters?: CreateCloudflareClientParameters) => {
    const { accessKeyId, accountId, jurisdiction, secretAccessKey } = parameters ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        jurisdiction: process.env.CLOUDFLARE_JURISDICTION || process.env.CLOUDFLARE_R2_JURISDICTION,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_KEY,
    };

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Cloudflare R2 client.");
    }

    return new S3Client({
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${accountId}.${jurisdiction ? `${jurisdiction}.` : ""}r2.cloudflarestorage.com`,
        region: "auto",
    });
};

export default cloudflare;
