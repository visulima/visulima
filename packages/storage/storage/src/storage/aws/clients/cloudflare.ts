import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateCloudflareClientParameters } from "./types";

/**
 * Create a Cloudflare R2 client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `CLOUDFLARE_ACCESS_KEY_ID` / `CLOUDFLARE_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `CLOUDFLARE_ACCOUNT_ID`
 * - `CLOUDFLARE_JURISDICTION` / `CLOUDFLARE_R2_JURISDICTION`
 * - `CLOUDFLARE_SECRET_ACCESS_KEY` / `CLOUDFLARE_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const cloudflare = (parameters?: CreateCloudflareClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.CLOUDFLARE_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const accountId = parameters?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    const jurisdiction = parameters?.jurisdiction ?? process.env.CLOUDFLARE_JURISDICTION ?? process.env.CLOUDFLARE_R2_JURISDICTION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.CLOUDFLARE_SECRET_ACCESS_KEY ?? process.env.CLOUDFLARE_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Cloudflare R2 client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${accountId}.${jurisdiction ? `${jurisdiction}.` : ""}r2.cloudflarestorage.com`,
        region: "auto",
    };
};

export default cloudflare;
