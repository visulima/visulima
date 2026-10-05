import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateWasabiClientParameters } from "./types";

/**
 * Create a Wasabi client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `WASABI_ACCESS_KEY_ID` / `WASABI_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `WASABI_REGION`, then `AWS_REGION`
 * - `WASABI_SECRET_ACCESS_KEY` / `WASABI_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const wasabi = (parameters?: CreateWasabiClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.WASABI_ACCESS_KEY_ID ?? process.env.WASABI_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const region = parameters?.region ?? process.env.WASABI_REGION ?? process.env.AWS_REGION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.WASABI_SECRET_ACCESS_KEY ?? process.env.WASABI_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Wasabi client.");
    }

    return {
        apiVersion: "2006-03-01",
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://s3.${region}.wasabisys.com`,
        region,
    };
};

export default wasabi;
