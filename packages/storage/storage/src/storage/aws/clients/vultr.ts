import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateVultrClientParameters } from "./types";

/**
 * Create a Vultr Object Storage client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables (the
 * first one set wins; a provider-specific variable wins over the generic `AWS_*` one):
 * - `VULTR_ACCESS_KEY_ID` / `VULTR_ACCESS_KEY`, then `AWS_ACCESS_KEY_ID`
 * - `VULTR_LOCATION` (cluster code, e.g. `ewr1`, `sjc1`, `ams1`, `sgp1`)
 * - `VULTR_SECRET_ACCESS_KEY` / `VULTR_SECRET_KEY`, then `AWS_SECRET_ACCESS_KEY`
 */
const vultr = (parameters?: CreateVultrClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.VULTR_ACCESS_KEY_ID ?? process.env.VULTR_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
    const location = parameters?.location ?? process.env.VULTR_LOCATION;
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.VULTR_SECRET_ACCESS_KEY ?? process.env.VULTR_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!location || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Vultr Object Storage client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${location}.vultrobjects.com`,
        forcePathStyle: false,
        region: location,
    };
};

export default vultr;
