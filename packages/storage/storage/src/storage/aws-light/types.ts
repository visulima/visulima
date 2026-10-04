import type { BaseStorageOptions, MetaStorageOptions } from "../types";

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
         * services differ in which `If-Match` / `If-None-Match` headers they honour. Always `false` with
         * `clientDirectUpload`.
         */
        conditional?: boolean;

        /**
         * Configure metafiles storage
         */
        metaStorageConfig?: AwsLightMetaStorageOptions;

        /**
         * The parts size that the client should use for presigned multipart unloading.
         * @default '16MB'
         */
        partSize?: number | string;
    };

export interface AwsLightError extends Error {
    code?: string;
    requestId?: string;
    statusCode?: number;
}
