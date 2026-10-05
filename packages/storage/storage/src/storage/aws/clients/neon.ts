import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateNeonClientParameters } from "./types";

/**
 * Create a Neon (branchable object storage) client, compatible with the S3 API.
 *
 * Neon injects `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into
 * the environment of a connected branch. Path-style addressing is always on: Neon's wildcard
 * TLS certificate covers a single subdomain level (`*.storage.{suffix}`), which the branch id
 * occupies, so the bucket has to travel in the request path.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ENDPOINT_URL_S3` / `NEON_STORAGE_ENDPOINT`
 * - `AWS_ACCESS_KEY_ID` / `NEON_STORAGE_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `NEON_STORAGE_SECRET_ACCESS_KEY`
 * - `AWS_REGION` / `NEON_STORAGE_REGION` (defaults to `us-east-1`)
 *
 * When neither credential is set anywhere, they are left to the AWS SDK credential chain.
 */
const neon = (parameters?: CreateNeonClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.NEON_STORAGE_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.AWS_ENDPOINT_URL_S3 ?? process.env.NEON_STORAGE_ENDPOINT;
    const region = parameters?.region ?? process.env.AWS_REGION ?? process.env.NEON_STORAGE_REGION ?? "us-east-1";
    const secretAccessKey = parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.NEON_STORAGE_SECRET_ACCESS_KEY;

    // An endpoint is required; credentials come as a pair or not at all.
    if (!endpoint || Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error("Missing required parameters for Neon storage client.");
    }

    return {
        ...(accessKeyId && secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
        endpoint,
        forcePathStyle: true,
        region,
    };
};

export default neon;
