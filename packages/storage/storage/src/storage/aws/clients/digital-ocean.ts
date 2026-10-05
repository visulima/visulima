import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateDigitalOceanClientParameters } from "./types";

/**
 * Create a DigitalOcean Spaces client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `SPACES_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `SPACES_REGION`, then `AWS_REGION`
 * - `SPACES_SECRET`, then `AWS_SECRET_ACCESS_KEY`
 */
const digitalOcean = (parameters?: CreateDigitalOceanClientParameters): S3ClientConfig => {
    const key = parameters?.key ?? process.env.SPACES_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const region = parameters?.region ?? process.env.SPACES_REGION ?? process.env.AWS_REGION;
    const secret = parameters?.secret ?? process.env.SPACES_SECRET ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !key || !secret) {
        throw new Error("Missing required parameters for DigitalOcean Spaces client.");
    }

    return {
        credentials: {
            accessKeyId: key,
            secretAccessKey: secret,
        },
        endpoint: `https://${region}.digitaloceanspaces.com`,
        forcePathStyle: false,
        region: "us-east-1",
    };
};

export default digitalOcean;
