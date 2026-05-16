import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateIDriveE2ClientParameters } from "./types";

/**
 * Create an iDrive e2 client, compatible with the S3 API.
 *
 * iDrive e2 endpoints are account/region specific and assigned by iDrive
 * (e.g. `https://x9y8.va.idrivee2-12.com`), so the endpoint must be supplied.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `IDRIVE_E2_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `IDRIVE_E2_SECRET_ACCESS_KEY`
 * - `IDRIVE_E2_ENDPOINT`
 * - `IDRIVE_E2_REGION` (defaults to `us-east-1`)
 */
const idriveE2 = (parameters?: CreateIDriveE2ClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.IDRIVE_E2_ACCESS_KEY_ID ?? process.env.IDRIVE_E2_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.AWS_ENDPOINT ?? process.env.IDRIVE_E2_ENDPOINT;
    const region = parameters?.region ?? process.env.AWS_REGION ?? process.env.IDRIVE_E2_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.IDRIVE_E2_SECRET_ACCESS_KEY ?? process.env.IDRIVE_E2_SECRET_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for iDrive e2 client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint,
        forcePathStyle: true,
        region: region ?? "us-east-1",
    };
};

export default idriveE2;
