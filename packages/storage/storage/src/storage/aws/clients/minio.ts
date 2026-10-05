import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateMinioClientParameters } from "./types";

/**
 * Create a Minio client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `MINIO_ACCESS_KEY_ID` / `MINIO_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `MINIO_ENDPOINT`, then `AWS_ENDPOINT`
 * - `MINIO_REGION`, then `AWS_REGION`
 * - `MINIO_SECRET_ACCESS_KEY` / `MINIO_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const minio = (parameters?: CreateMinioClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.MINIO_ACCESS_KEY_ID ?? process.env.MINIO_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.MINIO_ENDPOINT ?? process.env.AWS_ENDPOINT;
    const region = parameters?.region ?? process.env.MINIO_REGION ?? process.env.AWS_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.MINIO_SECRET_ACCESS_KEY ?? process.env.MINIO_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey || !endpoint) {
        throw new Error("Missing required parameters for Minio client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint,
        forcePathStyle: true,
        region,
    };
};

export default minio;
