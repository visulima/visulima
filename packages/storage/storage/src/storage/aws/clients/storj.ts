import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateStorjClientParameters } from "./types";

/**
 * Create a Storj S3 Gateway client, compatible with the S3 API.
 *
 * Credentials are derived from a Storj access grant via the
 * `storj.io/uplink` CLI or web console. The default endpoint targets the
 * global Storj S3 Gateway; self-hosted gateways can override via `endpoint`.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `STORJ_ACCESS_KEY_ID` / `STORJ_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `STORJ_ENDPOINT` (defaults to `https://gateway.storjshare.io`)
 * - `STORJ_SECRET_ACCESS_KEY` / `STORJ_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const storj = (parameters?: CreateStorjClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.STORJ_ACCESS_KEY_ID ?? process.env.STORJ_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.STORJ_ENDPOINT;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.STORJ_SECRET_ACCESS_KEY ?? process.env.STORJ_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Storj client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://gateway.storjshare.io",
        forcePathStyle: false,
        region: "global",
    };
};

export default storj;
