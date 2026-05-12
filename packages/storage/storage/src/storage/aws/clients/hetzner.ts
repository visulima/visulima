import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateHetznerClientParameters } from "./types";

const HETZNER_LOCATIONS = new Set(["fsn1", "hel1", "nbg1"]);

/**
 * Create a Hetzner Object Storage client, compatible with the S3 API.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `HETZNER_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `HETZNER_SECRET_ACCESS_KEY`
 * - `HETZNER_LOCATION` (one of `fsn1`, `nbg1`, `hel1`)
 */
const hetzner = (parameters?: CreateHetznerClientParameters): S3ClientConfig => {
    // Fall back to env vars on a per-field basis so a caller can override one parameter without
    // having to repeat the others. Using `parameters ?? envObject` drops the fallback wholesale
    // for partial inputs.
    const accessKeyId = parameters?.accessKeyId
        ?? process.env.AWS_ACCESS_KEY_ID
        ?? process.env.HETZNER_ACCESS_KEY_ID
        ?? process.env.HETZNER_ACCESS_KEY;
    const location = parameters?.location
        ?? (process.env.HETZNER_LOCATION as CreateHetznerClientParameters["location"] | undefined);
    const secretAccessKey = parameters?.secretAccessKey
        ?? process.env.AWS_SECRET_ACCESS_KEY
        ?? process.env.HETZNER_SECRET_ACCESS_KEY
        ?? process.env.HETZNER_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey || !location) {
        throw new Error("Missing required parameters for Hetzner Object Storage client.");
    }

    if (!HETZNER_LOCATIONS.has(location)) {
        throw new Error(`Invalid Hetzner location "${location}". Expected one of: ${[...HETZNER_LOCATIONS].join(", ")}.`);
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${location}.your-objectstorage.com`,
        forcePathStyle: false,
        region: location,
    };
};

export default hetzner;
