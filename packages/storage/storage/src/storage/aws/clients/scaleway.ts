import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateScalewayClientParameters } from "./types";

const SCALEWAY_REGIONS = new Set(["fr-par", "nl-ams", "pl-waw"]);

/**
 * Create a Scaleway Object Storage client, compatible with the S3 API.
 *
 * The region is part of the endpoint hostname, so it is not read from
 * `AWS_REGION` (which is commonly set to an AWS region in dev/CI and would
 * silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `SCALEWAY_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `SCALEWAY_SECRET_ACCESS_KEY`
 * - `SCALEWAY_REGION` (one of `fr-par`, `nl-ams`, `pl-waw`)
 */
const scaleway = (parameters?: CreateScalewayClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.SCALEWAY_ACCESS_KEY_ID ?? process.env.SCALEWAY_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.SCALEWAY_ENDPOINT;
    const region = parameters?.region ?? (process.env.SCALEWAY_REGION as CreateScalewayClientParameters["region"] | undefined);
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SCALEWAY_SECRET_ACCESS_KEY ?? process.env.SCALEWAY_SECRET_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Scaleway Object Storage client.");
    }

    if (!SCALEWAY_REGIONS.has(region)) {
        throw new Error(`Invalid Scaleway region "${region}". Expected one of: ${[...SCALEWAY_REGIONS].join(", ")}.`);
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? `https://s3.${region}.scw.cloud`,
        forcePathStyle: false,
        region,
    };
};

export default scaleway;
