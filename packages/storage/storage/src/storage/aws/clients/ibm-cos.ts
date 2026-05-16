import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateIbmCosClientParameters } from "./types";

/**
 * Create an IBM Cloud Object Storage client, compatible with the S3 API.
 *
 * Requires HMAC credentials (a Customer Secret Key, not an IAM API key).
 *
 * The region is part of the default endpoint hostname, so it is not read
 * from `AWS_REGION` (which is commonly set to an AWS region in dev/CI and
 * would silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `IBM_COS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `IBM_COS_SECRET_ACCESS_KEY`
 * - `IBM_COS_REGION` (e.g. `us-south`, `eu-de`, `jp-tok`)
 * - `IBM_COS_ENDPOINT`
 */
const ibmCos = (parameters?: CreateIbmCosClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.IBM_COS_ACCESS_KEY_ID ?? process.env.IBM_COS_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.IBM_COS_ENDPOINT;
    const region = parameters?.region ?? process.env.IBM_COS_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.IBM_COS_SECRET_ACCESS_KEY ?? process.env.IBM_COS_SECRET_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for IBM Cloud Object Storage client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? `https://s3.${region}.cloud-object-storage.appdomain.cloud`,
        forcePathStyle: false,
        region,
    };
};

export default ibmCos;
