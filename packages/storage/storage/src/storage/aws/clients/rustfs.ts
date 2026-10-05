import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateRustFsClientParameters } from "./types";

/**
 * Create a RustFS client, compatible with the S3 API.
 *
 * RustFS is a self-hosted, MinIO-compatible object store. Its S3 API listens on port 9000
 * by default (the console on 9001). Path-style addressing is the default, because
 * virtual-hosted requests only work once `RUSTFS_SERVER_DOMAINS` and wildcard DNS are set up.
 * The region must match the server's `RUSTFS_REGION` (default `us-east-1`), or it rejects the
 * signature.
 *
 * Optionally, you can omit the parameters and use the following environment variables
 * (the server-side names are accepted too, so one `.env` configures both sides):
 * - `AWS_ACCESS_KEY_ID` / `RUSTFS_ACCESS_KEY_ID` / `RUSTFS_ACCESS_KEY`
 * - `AWS_SECRET_ACCESS_KEY` / `RUSTFS_SECRET_ACCESS_KEY` / `RUSTFS_SECRET_KEY`
 * - `RUSTFS_ENDPOINT` (defaults to `http://localhost:9000`)
 * - `RUSTFS_REGION` (defaults to `us-east-1`)
 */
const rustfs = (parameters?: CreateRustFsClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.RUSTFS_ACCESS_KEY_ID ?? process.env.RUSTFS_ACCESS_KEY;
    const endpoint = parameters?.endpoint ?? process.env.RUSTFS_ENDPOINT;
    const region = parameters?.region ?? process.env.RUSTFS_REGION ?? "us-east-1";
    const secretAccessKey =
        parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.RUSTFS_SECRET_ACCESS_KEY ?? process.env.RUSTFS_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for RustFS client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "http://localhost:9000",
        forcePathStyle: parameters?.forcePathStyle ?? true,
        region,
    };
};

export default rustfs;
