// eslint-disable-next-line import/no-extraneous-dependencies
import { ResponseMetadata } from "@aws-sdk/types";
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
