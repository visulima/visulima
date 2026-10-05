import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateFilebaseClientParameters } from "./types";

/**
 * Create a Filebase client, compatible with the S3 API.
 *
 * Filebase exposes a single global endpoint and ignores the region, so only
 * credentials are required.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `FILEBASE_ACCESS_KEY_ID` / `FILEBASE_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `FILEBASE_ENDPOINT` (defaults to `https://s3.filebase.com`)
 * - `FILEBASE_SECRET_ACCESS_KEY` / `FILEBASE_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const filebase = (parameters?: CreateFilebaseClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.FILEBASE_ACCESS_KEY_ID ?? process.env.FILEBASE_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.FILEBASE_ENDPOINT;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.FILEBASE_SECRET_ACCESS_KEY ?? process.env.FILEBASE_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Filebase client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://s3.filebase.com",
        forcePathStyle: true,
        region: "us-east-1",
    };
};

export default filebase;
