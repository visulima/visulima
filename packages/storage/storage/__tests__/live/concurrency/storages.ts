import S3Storage from "../../../src/storage/aws/s3-storage";
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import AzureStorage from "../../../src/storage/azure/azure-storage";
import type { BaseStorage } from "../../../src/storage/storage";

/** S3's smallest non-final part. */
export const PART_SIZE = 5 * 1024 * 1024;

/** `size` bytes of a pattern `seed` picks, so any range of an upload has known content. */
export const pattern = (size: number, seed = 0): Buffer => {
    const buffer = Buffer.alloc(size);

    for (let index = 0; index < size; index += 1) {
        buffer[index] = (index + seed) % 251;
    }

    return buffer;
};

/** Where a worker process finds the shared bucket or container; JSON, so it can cross the process boundary. */
export type LiveTarget =
    | { bucket: string; kind: "aws-light" | "s3"; s3: { accessKeyId: string; endpoint: string; region: string; secretAccessKey: string } }
    | { connectionString: string; containerName: string; kind: "azure" };

/**
 * A storage over the target, with its meta store in the same bucket or container, so every process
 * sees the same uploads. Kept free of vitest, as the worker process bundles it.
 */
export const createLiveStorage = (target: LiveTarget): BaseStorage => {
    const common = { expiration: { maxAge: "1h" }, retryConfig: { maxRetries: 0 } };

    if (target.kind === "azure") {
        return new AzureStorage({ ...common, connectionString: target.connectionString, containerName: target.containerName });
    }

    if (target.kind === "aws-light") {
        return new AwsLightStorage({ ...common, ...target.s3, bucket: target.bucket, conditional: true });
    }

    return new S3Storage({
        ...common,
        bucket: target.bucket,
        conditional: true,
        credentials: target.s3,
        endpoint: target.s3.endpoint,
        forcePathStyle: true,
        region: target.s3.region,
    });
};
