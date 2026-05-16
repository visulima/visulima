import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateOracleCloudClientParameters } from "./types";

/**
 * Create an Oracle Cloud Infrastructure (OCI) Object Storage client, using
 * the S3 Compatibility API.
 *
 * Requires a Customer Secret Key (generated under the user's API keys) and
 * the tenancy's Object Storage namespace.
 *
 * The region is part of the endpoint hostname, so it is not read from
 * `AWS_REGION` (commonly set to an AWS region in dev/CI, which would
 * silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `ORACLE_CLOUD_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `ORACLE_CLOUD_SECRET_ACCESS_KEY`
 * - `ORACLE_CLOUD_NAMESPACE`
 * - `ORACLE_CLOUD_REGION` (e.g. `us-ashburn-1`, `eu-frankfurt-1`)
 */
const oracleCloud = (parameters?: CreateOracleCloudClientParameters): S3ClientConfig => {
    const accessKeyId =
        parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.ORACLE_CLOUD_ACCESS_KEY_ID ?? process.env.ORACLE_CLOUD_ACCESS_KEY;
    const namespace = parameters?.namespace ?? process.env.ORACLE_CLOUD_NAMESPACE;
    const region = parameters?.region ?? process.env.ORACLE_CLOUD_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.ORACLE_CLOUD_SECRET_ACCESS_KEY ?? process.env.ORACLE_CLOUD_SECRET_KEY;

    if (!namespace || !region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Oracle Cloud Object Storage client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${namespace}.compat.objectstorage.${region}.oraclecloud.com`,
        forcePathStyle: true,
        region,
    };
};

export default oracleCloud;
