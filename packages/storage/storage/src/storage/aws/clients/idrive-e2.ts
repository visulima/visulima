import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateIDriveE2ClientParameters } from "./types";

/**
 * Create an iDrive e2 client, compatible with the S3 API.
 *
 * iDrive e2 endpoints are account/region specific and assigned by iDrive
 * (e.g. `https://x9y8.va.idrivee2-12.com`), so the endpoint must be supplied.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `IDRIVE_E2_ACCESS_KEY_ID` / `IDRIVE_E2_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `IDRIVE_E2_ENDPOINT`, then `AWS_ENDPOINT`
 * - `IDRIVE_E2_REGION`, then `AWS_REGION` (defaults to `us-east-1`)
 * - `IDRIVE_E2_SECRET_ACCESS_KEY` / `IDRIVE_E2_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const idriveE2 = (parameters?: CreateIDriveE2ClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.IDRIVE_E2_ACCESS_KEY_ID ?? process.env.IDRIVE_E2_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.IDRIVE_E2_ENDPOINT ?? process.env.AWS_ENDPOINT;
    const region = parameters?.region ?? process.env.IDRIVE_E2_REGION ?? process.env.AWS_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.IDRIVE_E2_SECRET_ACCESS_KEY ?? process.env.IDRIVE_E2_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

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
