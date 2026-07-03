import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateMinioClientParameters } from "./types";

/**
 * Create a Minio client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_REGION`
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY`
 * - `MINIO_ENDPOINT`
 */
const minio = (parameters?: CreateMinioClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.MINIO_ACCESS_KEY_ID ?? process.env.MINIO_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.AWS_ENDPOINT ?? process.env.MINIO_ENDPOINT;
    const region = parameters?.region ?? process.env.AWS_REGION ?? process.env.MINIO_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.MINIO_SECRET_ACCESS_KEY ?? process.env.MINIO_SECRET_KEY;

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
