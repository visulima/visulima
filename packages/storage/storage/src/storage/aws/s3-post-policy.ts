import { createHmac } from "node:crypto";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type { UploadPostPolicy } from "../types";

/** SigV4 signatures, presigned URLs and POST policies alike, live at most 7 days. */
export const MAX_SIGV4_EXPIRES_IN = 604_800;

/** Largest object a single S3 PUT or POST may store. */
const MAX_SINGLE_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024;

const hmac = (key: Buffer | string, data: string): Buffer => createHmac("sha256", key).update(data).digest();

/** `20240102T030405Z` */
const amzDate = (date: Date): string => date.toISOString().replaceAll(/[:-]|\.\d{3}/gu, "");

export interface S3PostPolicyInput {
    accessKeyId: string;
    bucket: string;
    contentType?: string;
    expiresIn?: number;
    key: string;
    maxSize?: number;
    minSize?: number;
    /** Signing time; defaults to now. */
    now?: Date;
    region: string;
    secretAccessKey: string;
    service?: string;
    sessionToken?: string;
    /** Bucket URL the form is posted to (virtual-hosted `https://bucket.s3.region.amazonaws.com` or path-style `https://host/bucket`). */
    url: string;
}

/**
 * Signs an S3 browser-form POST policy (SigV4) for one object. S3 checks the `content-length-range`
 * condition itself and answers `EntityTooLarge` / `EntityTooSmall` (400) before storing anything,
 * so the size range holds even against a client that lies about its body.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
 */
export const createS3PostPolicy = (input: S3PostPolicyInput): UploadPostPolicy => {
    const expiresIn = input.expiresIn ?? 3600;
    const minSize = input.minSize ?? 0;
    const maxSize = input.maxSize ?? MAX_SINGLE_UPLOAD_SIZE;

    if (!Number.isInteger(expiresIn) || expiresIn <= 0 || expiresIn > MAX_SIGV4_EXPIRES_IN) {
        throwErrorCode(ERRORS.BAD_REQUEST, `expiresIn must be an integer between 1 and ${String(MAX_SIGV4_EXPIRES_IN)} seconds`);
    }

    if (!Number.isSafeInteger(minSize) || !Number.isSafeInteger(maxSize) || minSize < 0 || maxSize < minSize || maxSize > MAX_SINGLE_UPLOAD_SIZE) {
        throwErrorCode(ERRORS.BAD_REQUEST, `Invalid size range ${String(minSize)}-${String(maxSize)}`);
    }

    const now = input.now ?? new Date();
    const date = amzDate(now);
    const day = date.slice(0, 8);
    const service = input.service ?? "s3";
    const credential = `${input.accessKeyId}/${day}/${input.region}/${service}/aws4_request`;

    const fields: Record<string, string> = {
        key: input.key,
        ...(input.contentType !== undefined && { "Content-Type": input.contentType }),
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "x-amz-credential": credential,
        "x-amz-date": date,
        ...(input.sessionToken !== undefined && { "x-amz-security-token": input.sessionToken }),
    };

    const policy = Buffer.from(
        JSON.stringify({
            conditions: [
                { bucket: input.bucket },
                ...Object.entries(fields).map(([name, value]) => {
                    return { [name]: value };
                }),
                ["content-length-range", minSize, maxSize],
            ],
            expiration: new Date(now.getTime() + expiresIn * 1000).toISOString(),
        }),
    ).toString("base64");

    const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), service), "aws4_request");

    return {
        fields: { ...fields, Policy: policy, "X-Amz-Signature": hmac(signingKey, policy).toString("hex") },
        url: input.url,
    };
};
