// eslint-disable-next-line import/no-extraneous-dependencies
import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import S3File from "./s3-file";

export type S3MetaStorageOptions = S3ClientConfig &
MetaStorageOptions & {
    bucket?: string;
    keyFile?: string;
};

export type S3StorageOptions = BaseStorageOptions<S3File> &
S3ClientConfig & {
    /**
         * S3 bucket
         * @defaultValue 'node-Upload'
         */
    bucket?: string;
    /**
         *   Specifying access rules for uploaded files
         */
    acl?: "private" | "public-read" | string;
    /**
         * Force compatible client upload directly to S3 storage
         */
    clientDirectUpload?: boolean;
    /**
         * The parts size that the client should use for presigned multipart unloading
         * @defaultValue '16MB'
         */
    partSize?: number | string;
    /**
         * Configure metafiles storage
         * @example
         * Using local metafiles
         * ```ts
         * const storage = new S3Storage({
         *   bucket: 'uploads',
         *   region: 'eu-west-3',
         *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
         * })
         * ```
         * Using a separate bucket for metafiles
         * ```ts
         * const storage = new S3Storage({
         *   bucket: 'uploads',
         *   region: 'eu-west-3',
         *   metaStorageConfig: { bucket: 'upload-metafiles' }
         * })
         * ```
         */
    metaStorageConfig?: LocalMetaStorageOptions | S3MetaStorageOptions;
    /**
         * @deprecated Use standard auth providers
         */
    keyFile?: string;
};
