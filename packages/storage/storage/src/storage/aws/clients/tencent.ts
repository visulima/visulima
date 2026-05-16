import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateTencentClientParameters } from "./types";

/**
 * Create a Tencent Cloud COS client, compatible with the S3 API.
 *
 * The bucket name must include the APPID suffix (e.g.
 * `uploads-1250000000`); the S3-compatible API expects the full form.
 *
 * The region is part of the default endpoint hostname, so it is not read
 * from `AWS_REGION` (which is commonly set to an AWS region in dev/CI and
 * would silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `TENCENT_SECRET_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `TENCENT_SECRET_KEY`
 * - `TENCENT_REGION` (e.g. `ap-guangzhou`, `ap-singapore`, `eu-frankfurt`)
 * - `TENCENT_ENDPOINT`
 */
const tencent = (parameters?: CreateTencentClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.TENCENT_SECRET_ID;
    const endpoint = parameters?.endpoint ?? process.env.TENCENT_ENDPOINT;
    const region = parameters?.region ?? process.env.TENCENT_REGION;
    const secretAccessKey = parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.TENCENT_SECRET_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Tencent Cloud COS client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? `https://cos.${region}.myqcloud.com`,
        forcePathStyle: false,
        region,
    };
};

export default tencent;
