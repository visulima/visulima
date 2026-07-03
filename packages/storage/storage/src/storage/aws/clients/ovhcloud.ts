import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateOvhCloudClientParameters } from "./types";

/**
 * Create an OVHcloud Object Storage client, compatible with the S3 API.
 *
 * Defaults to the High Performance (S3) endpoint. For the Standard (Swift)
 * offering pass `endpoint: https://s3.{region}.cloud.ovh.net`.
 *
 * The region is part of the default endpoint hostname and the SigV4 signing
 * scope, both of which require lowercase, so the region is lowercased (the
 * OVH console displays it uppercase, e.g. `GRA`). It is not read from
 * `AWS_REGION` (commonly set to an AWS region in dev/CI, which would
 * silently produce a broken endpoint).
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `OVHCLOUD_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `OVHCLOUD_SECRET_ACCESS_KEY`
 * - `OVHCLOUD_REGION` (e.g. `gra`, `sbg`, `de`, `uk`, `waw`, `bhs`)
 * - `OVHCLOUD_ENDPOINT`
 */
const ovhCloud = (parameters?: CreateOvhCloudClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.OVHCLOUD_ACCESS_KEY_ID ?? process.env.OVHCLOUD_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.OVHCLOUD_ENDPOINT;
    const rawRegion = parameters?.region ?? process.env.OVHCLOUD_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.OVHCLOUD_SECRET_ACCESS_KEY ?? process.env.OVHCLOUD_SECRET_KEY;

    if (!rawRegion || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for OVHcloud Object Storage client.");
    }

    const region = rawRegion.toLowerCase();

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? `https://s3.${region}.io.cloud.ovh.net`,
        forcePathStyle: false,
        region,
    };
};

export default ovhCloud;
