import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateTigrisClientParameters } from "./types";

/**
 * Create a Tigris client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `TIGRIS_ACCESS_KEY_ID` / `TIGRIS_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `TIGRIS_ENDPOINT`
 * - `TIGRIS_SECRET_ACCESS_KEY` / `TIGRIS_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const tigris = (parameters?: CreateTigrisClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.TIGRIS_ACCESS_KEY_ID ?? process.env.TIGRIS_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.TIGRIS_ENDPOINT;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.TIGRIS_SECRET_ACCESS_KEY ?? process.env.TIGRIS_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Tigris client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://t3.storage.dev",
        forcePathStyle: false,
        region: "auto",
    };
};

export default tigris;
