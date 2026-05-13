import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateAkamaiClientParameters } from "./types";

/**
 * Create an Akamai Cloud Object Storage client, compatible with the S3 API.
 *
 * Akamai Cloud Object Storage is the rebranded Linode Object Storage; the
 * underlying `linodeobjects.com` domain is unchanged.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `AKAMAI_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `AKAMAI_SECRET_ACCESS_KEY`
 * - `AKAMAI_REGION` (e.g. `us-iad-1`)
 */
const akamai = (parameters?: Partial<CreateAkamaiClientParameters>): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.AKAMAI_ACCESS_KEY_ID;
    const secretAccessKey = parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AKAMAI_SECRET_ACCESS_KEY;
    const region = parameters?.region ?? process.env.AKAMAI_REGION;

    if (!accessKeyId || !secretAccessKey || !region) {
        throw new Error("Missing required parameters for Akamai Cloud Object Storage client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: parameters?.endpoint ?? `https://${region}.linodeobjects.com`,
        forcePathStyle: false,
        region,
    };
};

export default akamai;
