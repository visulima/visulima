import type { BaseStorageOptions, ConditionalSupport, MetaStorageOptions } from "../types";

export interface AwsLightClientConfig {
    accessKeyId: string;
    endpoint?: string;
    region: string;
    secretAccessKey: string;
    service?: string;
    sessionToken?: string;
}

export type AwsLightMetaStorageOptions = AwsLightClientConfig &
    MetaStorageOptions & {
        bucket?: string;
    };

export type AwsLightStorageOptions = AwsLightClientConfig &
    BaseStorageOptions & {
        /**
         * S3 bucket name.
         */
        bucket?: string;

        /**
         * Force compatible client upload directly to S3 storage
         */
        clientDirectUpload?: boolean;

        /**
         * Send conditional (ETag) requests and advertise them in `Files.capabilities.conditional`.
         * Defaults to `true` for AWS S3 and `false` when a custom `endpoint` is set, because S3-compatible
         * services differ in which `If-Match` / `If-None-Match` headers they honour. Set it explicitly to
         * override the detection: `true` enables every kind, an object only the kinds set to `true`
         * (`create` / `replace` send the predicate on CompleteMultipartUpload, `read` on GetObject,
         * `delete` on DeleteObject, `copy` on CopyObject). Always `false` with `clientDirectUpload`.
         * @example `{ copy: true, read: true }` for Cloudflare R2, which documents conditional headers
         * on GetObject, PutObject and CopyObject only.
         */
        conditional?: boolean | Partial<ConditionalSupport>;

        /**
         * Configure metafiles storage
         */
        metaStorageConfig?: AwsLightMetaStorageOptions;

        /**
         * The parts size that the client should use for presigned multipart unloading.
         * @default '16MB'
         */
        partSize?: number | string;

        /**
         * Sign browser-form POST policies, so `Files.signedUpload` can enforce a size range
         * (`Files.capabilities.signedUploadPost`). Defaults to `true` for AWS S3 and `false` when a
         * custom `endpoint` is set: not every S3-compatible service accepts POST uploads (Cloudflare R2
         * does not). Set it to `true` for one that does (MinIO, SeaweedFS, …).
         */
        uploadPost?: boolean;
    };

export interface AwsLightError extends Error {
    code?: string;
    requestId?: string;
    statusCode?: number;
}
