import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateExoscaleClientParameters } from "./types";

/**
 * Create an Exoscale SOS client, compatible with the S3 API.
 *
 * The zone is part of the endpoint hostname, so it is not read from
 * `AWS_REGION` (which is commonly set to an AWS region in dev/CI and would
 * silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `EXOSCALE_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `EXOSCALE_SECRET_ACCESS_KEY`
 * - `EXOSCALE_ZONE` (e.g. `ch-gva-2`, `de-fra-1`, `at-vie-1`)
 */
const exoscale = (parameters?: CreateExoscaleClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.EXOSCALE_ACCESS_KEY_ID ?? process.env.EXOSCALE_ACCESS_KEY;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.EXOSCALE_SECRET_ACCESS_KEY ?? process.env.EXOSCALE_SECRET_KEY;
    const zone = parameters?.zone ?? process.env.EXOSCALE_ZONE;

    if (!zone || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Exoscale SOS client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://sos-${zone}.exo.io`,
        forcePathStyle: false,
        region: zone,
    };
};

export default exoscale;
