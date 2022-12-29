// eslint-disable-next-line import/no-extraneous-dependencies
import type { S3ClientConfig } from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
import { ResponseMetadata } from "@aws-sdk/types";
// eslint-disable-next-line import/no-extraneous-dependencies
import { S3Client } from "@aws-sdk/client-s3";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import S3File from "./s3-file";

export type S3MetaStorageOptions = S3ClientConfig &
MetaStorageOptions & {
    bucket?: string;
    keyFile?: string;

    /**
     * @internal - used for internal client inheritance, if same client is used for meta and file storage
     */
    client?: S3Client;
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
         *   bucket: 'upload',
         *   region: 'eu-west-3',
         *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
         * })
         * ```
         * Using a separate bucket for metafiles
         * ```ts
         * const storage = new S3Storage({
         *   bucket: 'upload',
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
/**
 * SDK V3
 * A structure containing information about a service or networking error.
 */
export interface AwsError extends Error {
    $metadata: ResponseMetadata;
    Type?: string;
    Code?: string;
    $fault?: "client" | "server";
    $service?: string;
}

/**
 * SDK V2
 * A structure containing information about a service or networking error.
 * @internal
 */

export interface AWSErrorV2 extends Error {
    /**
     * A unique short code representing the error that was emitted.
     */
    code: string;
    /**
     * A longer human readable error message.
     */
    message: string;
    /**
     * Whether the error message is retryable.
     */
    retryable: boolean;
    /**
     * In the case of a request that reached the service, this value contains the response status code.
     */
    statusCode: number;
    /**
     * The date time object when the error occurred.
     */
    time: Date;
    /**
     * Set when a networking error occurs to easily identify the endpoint of the request.
     */
    hostname: string;
    /**
     * Set when a networking error occurs to easily identify the region of the request.
     */
    region: string;
    /**
     * Amount of time (in seconds) that the request waited before being resent.
     */
    retryDelay: number;
    /**
     * The unique request ID associated with the response.
     */
    requestId: string;
    /**
     * Second request ID associated with the response from S3.
     */
    extendedRequestId: string;
    /**
     * CloudFront request ID associated with the response.
     */
    cfId: string;
}
