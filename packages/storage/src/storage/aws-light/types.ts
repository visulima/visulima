import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import type AwsLightFile from "./aws-light-file";

export interface AwsLightClientConfig {
    accessKeyId: string;
    endpoint?: string;
    region: string;
    secretAccessKey: string;
    service?: string;
    sessionToken?: string;
}

export type AwsLightMetaStorageOptions = AwsLightClientConfig
    & MetaStorageOptions & {
        bucket?: string;
    };

export type AwsLightStorageOptions = AwsLightClientConfig
    & BaseStorageOptions<AwsLightFile> & {
        /**
         * S3 bucket name.
         */
        bucket?: string;

        /**
         * Force compatible client upload directly to S3 storage
         */
        clientDirectUpload?: boolean;

        /**
         * Configure metafiles storage
         */
        metaStorageConfig?: LocalMetaStorageOptions | AwsLightMetaStorageOptions;

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
