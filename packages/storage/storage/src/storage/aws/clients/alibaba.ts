import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateAlibabaClientParameters } from "./types";

/**
 * Create an Alibaba Cloud OSS client, compatible with the S3 API.
 *
 * The region is part of the default endpoint hostname, so it is not read
 * from `AWS_REGION` (which is commonly set to an AWS region in dev/CI and
 * would silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `ALIBABA_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `ALIBABA_ACCESS_KEY_SECRET`
 * - `ALIBABA_REGION` (e.g. `cn-hangzhou`, `ap-southeast-1`, `eu-central-1`)
 * - `ALIBABA_ENDPOINT`
 */
const alibaba = (parameters?: CreateAlibabaClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.ALIBABA_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.ALIBABA_ENDPOINT;
    const region = parameters?.region ?? process.env.ALIBABA_REGION;
    const secretAccessKey = parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.ALIBABA_ACCESS_KEY_SECRET;

    if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Alibaba Cloud OSS client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? `https://s3.oss-${region}.aliyuncs.com`,
        forcePathStyle: false,
        region,
    };
};

export default alibaba;
