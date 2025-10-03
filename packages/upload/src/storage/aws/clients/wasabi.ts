import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateWasabiClientParameters } from "./types";

/**
 * Create a Wasabi client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `WASABI_REGION`
 * - `AWS_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY`
 */
const wasabi = (parameters?: CreateWasabiClientParameters): S3ClientConfig => {
    const { accessKeyId, region, secretAccessKey } = parameters ?? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.WASABI_ACCESS_KEY_ID || process.env.WASABI_ACCESS_KEY,
        region: process.env.AWS_REGION || process.env.WASABI_REGION,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.WASABI_SECRET_ACCESS_KEY || process.env.WASABI_SECRET_KEY,
    };

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
