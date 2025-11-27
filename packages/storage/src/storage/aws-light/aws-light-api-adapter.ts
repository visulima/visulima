import { Readable } from "node:stream";

import { AwsClient } from "aws4fetch";

import type { Part, S3ApiOperations } from "../aws/s3-base-storage";
import type { AwsLightClientConfig } from "./types";

/**
 * Simple XML parser for S3 API responses.
 * Uses regex-based parsing for simplicity and cross-platform compatibility.
 */
const parseXml = (text: string): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    // Remove XML declaration and namespaces
    const cleanText = text.replaceAll(/<\?xml[^>]*\?>/g, "").replaceAll(/xmlns[^=]*="[^"]*"/g, "");

    // Extract tags and their content
    const tagRegex = /<([^>]+)>([^<]*)<\/\1>/g;
    const matches = [...cleanText.matchAll(tagRegex)];

    for (const match of matches) {
        const [, tagName, content] = match;

        if (tagName && content && content.trim()) {
            if (result[tagName]) {
                // Multiple children with same tag - convert to array
                if (!Array.isArray(result[tagName])) {
                    result[tagName] = [result[tagName]];
                }

                (result[tagName] as unknown[]).push(content.trim());
            } else {
                result[tagName] = content.trim();
            }
        }
    }

    // Handle nested structures
    const nestedRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;
    let nestedMatch;

    // eslint-disable-next-line no-cond-assign
    while ((nestedMatch = nestedRegex.exec(cleanText)) !== null) {
        const [, tagName, innerContent] = nestedMatch;

        if (tagName && innerContent && innerContent.includes("<")) {
            const nested = parseXml(innerContent);

            if (Object.keys(nested).length > 0) {
                result[tagName] = nested;
            }
        }
    }

    return result;
};

/**
 * Adapter that uses aws4fetch to implement S3ApiOperations interface.
 */
class AwsLightApiAdapter implements S3ApiOperations {
    private aws: AwsClient;

    private readonly bucket: string;

    private readonly endpoint: string;

    public constructor(config: AwsLightClientConfig & { bucket: string }) {
        this.bucket = config.bucket;
        this.endpoint = config.endpoint || `https://${config.bucket}.s3.${config.region}.amazonaws.com`;

        this.aws = new AwsClient({
            accessKeyId: config.accessKeyId,
            region: config.region,
            secretAccessKey: config.secretAccessKey,
            service: config.service || "s3",
            sessionToken: config.sessionToken,
        });
    }

    public async createMultipartUpload(params: {
        ACL?: string;
        Bucket: string;
        ContentType?: string;
        Key: string;
        Metadata?: Record<string, string>;
    }): Promise<{ UploadId: string }> {
        const queryParams: Record<string, string> = { uploads: "" };
        const headers: Record<string, string> = {};

        if (params.ContentType) {
            headers["Content-Type"] = params.ContentType;
        }

        if (params.ACL) {
            headers["x-amz-acl"] = params.ACL;
        }

        if (params.Metadata) {
            for (const [key, value] of Object.entries(params.Metadata)) {
                headers[`x-amz-meta-${key}`] = value;
            }
        }

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            headers,
            method: "POST",
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw new Error(`Failed to create multipart upload: ${response.status} ${xmlText}`);
        }

        const xml = parseXml(xmlText);
        const uploadId = (xml.UploadId as string) || ((xml.InitiateMultipartUploadResult as Record<string, unknown>)?.UploadId as string);

        if (!uploadId) {
            const error = new Error("Failed to parse UploadId from response");

            (error as { retryable?: boolean }).retryable = false;
            throw error;
        }

        return { UploadId: uploadId };
    }

    public async uploadPart(params: {
        Body: Readable | ReadableStream | Uint8Array;
        Bucket: string;
        ContentLength?: number;
        ContentMD5?: string;
        Key: string;
        PartNumber: number;
        UploadId: string;
    }): Promise<{ ETag: string }> {
        const queryParams: Record<string, string> = {
            partNumber: String(params.PartNumber),
            uploadId: params.UploadId,
        };
        const headers: Record<string, string> = {};

        if (params.ContentLength) {
            headers["Content-Length"] = String(params.ContentLength);
        }

        if (params.ContentMD5) {
            headers["Content-MD5"] = params.ContentMD5;
        }

        // Convert Readable to ReadableStream if needed
        let body: BodyInit;

        if (params.Body instanceof Readable) {
            // Convert Node.js Readable to ReadableStream
            body = Readable.toWeb(params.Body) as unknown as ReadableStream<Uint8Array>;
        } else {
            body = params.Body as BodyInit;
        }

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            body,
            headers,
            method: "PUT",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to upload part: ${response.status} ${text}`);
        }

        // Note: Response body is consumed by the fetch, so we don't need to read it for successful PUT requests

        const etag = response.headers.get("ETag");

        if (!etag) {
            throw new Error("Failed to get ETag from response");
        }

        // Remove quotes from ETag
        return { ETag: etag.replaceAll(/^"|"$/g, "") };
    }

    public async completeMultipartUpload(params: {
        Bucket: string;
        Key: string;
        Parts: { ETag: string; PartNumber: number }[];
        UploadId: string;
    }): Promise<{ ETag?: string; Location: string }> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };

        // Build XML body for complete multipart upload
        const partsXml = params.Parts.map(({ ETag, PartNumber }) => `<Part><PartNumber>${PartNumber}</PartNumber><ETag>"${ETag}"</ETag></Part>`).join("");

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${partsXml}
</CompleteMultipartUpload>`;

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            body: xmlBody,
            headers: {
                "Content-Type": "application/xml",
            },
            method: "POST",
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw new Error(`Failed to complete multipart upload: ${response.status} ${xmlText}`);
        }

        const xml = parseXml(xmlText);
        const result = (xml.CompleteMultipartUploadResult as Record<string, unknown>) || xml;

        const location = (result.Location as string) || `${this.endpoint}/${params.Key}`;
        const etag = result.ETag as string | undefined;

        return {
            ETag: etag?.replaceAll(/^"|"$/g, ""),
            Location: location,
        };
    }

    public async abortMultipartUpload(params: { Bucket: string; Key: string; UploadId: string }): Promise<void> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };
        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            method: "DELETE",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to abort multipart upload: ${response.status} ${text}`);
        }
    }

    public async listParts(params: { Bucket: string; Key: string; UploadId: string }): Promise<{ Parts?: Part[] }> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };
        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            method: "GET",
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw new Error(`Failed to list parts: ${response.status} ${xmlText}`);
        }

        const xml = parseXml(xmlText);
        const listPartsResult = (xml.ListPartsResult as Record<string, unknown>) || xml;
        const parts = listPartsResult.Part ? Array.isArray(listPartsResult.Part) ? listPartsResult.Part : [listPartsResult.Part] : [];

        return {
            Parts: parts.map((part: Record<string, unknown>) => {
                return {
                    ETag: (part.ETag as string)?.replaceAll(/^"|"$/g, ""),
                    PartNumber: Number(part.PartNumber) || 0,
                    Size: part.Size ? Number(part.Size) : undefined,
                };
            }),
        };
    }

    public async getObject(params: { Bucket: string; Key: string }): Promise<{
        Body?: ReadableStream | Readable;
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }> {
        const url = this.buildUrl(params.Key);
        const response = await this.aws.fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to get object: ${response.status} ${text}`);
        }

        // Note: Response body is consumed by the fetch, so we don't need to read it for successful GET requests

        const contentLength = response.headers.get("Content-Length");
        const contentType = response.headers.get("Content-Type");
        const etag = response.headers.get("ETag");
        const expires = response.headers.get("Expires");
        const lastModified = response.headers.get("Last-Modified");

        const metadata: Record<string, string> = {};

        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase().startsWith("x-amz-meta-")) {
                const metaKey = key.toLowerCase().replace("x-amz-meta-", "");

                metadata[metaKey] = value;
            }
        }

        const { body } = response;

        return {
            Body: body ? this.streamToReadable(body) : undefined,
            ContentLength: contentLength ? Number(contentLength) : undefined,
            ContentType: contentType || undefined,
            ETag: etag?.replaceAll(/^"|"$/g, "") || undefined,
            Expires: expires ? new Date(expires) : undefined,
            LastModified: lastModified ? new Date(lastModified) : undefined,
            Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    public async headObject(params: { Bucket: string; Key: string }): Promise<{
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }> {
        const url = this.buildUrl(params.Key);
        const response = await this.aws.fetch(url, {
            method: "HEAD",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to head object: ${response.status} ${text}`);
        }

        const contentLength = response.headers.get("Content-Length");
        const contentType = response.headers.get("Content-Type");
        const etag = response.headers.get("ETag");
        const expires = response.headers.get("Expires");
        const lastModified = response.headers.get("Last-Modified");

        const metadata: Record<string, string> = {};

        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase().startsWith("x-amz-meta-")) {
                const metaKey = key.toLowerCase().replace("x-amz-meta-", "");

                metadata[metaKey] = value;
            }
        }

        return {
            ContentLength: contentLength ? Number(contentLength) : undefined,
            ContentType: contentType || undefined,
            ETag: etag?.replaceAll(/^"|"$/g, "") || undefined,
            Expires: expires ? new Date(expires) : undefined,
            LastModified: lastModified ? new Date(lastModified) : undefined,
            Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    public async deleteObject(params: { Bucket: string; Key: string }): Promise<void> {
        const url = this.buildUrl(params.Key);
        const response = await this.aws.fetch(url, {
            method: "DELETE",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to delete object: ${response.status} ${text}`);
        }
    }

    public async copyObject(params: { Bucket: string; CopySource: string; Key: string; StorageClass?: string }): Promise<void> {
        const headers: Record<string, string> = {
            "x-amz-copy-source": params.CopySource,
        };

        if (params.StorageClass) {
            headers["x-amz-storage-class"] = params.StorageClass;
        }

        let url = this.buildUrl(params.Key);

        if (params.Bucket !== this.bucket) {
            url = url.replace(this.bucket, params.Bucket);
        }

        const response = await this.aws.fetch(url, {
            headers,
            method: "PUT",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to copy object: ${response.status} ${text}`);
        }
    }

    public async listObjectsV2(params: { Bucket: string; ContinuationToken?: string; MaxKeys?: number }): Promise<{
        Contents?: { Key?: string; LastModified?: Date }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
    }> {
        const queryParams: Record<string, string> = {
            "list-type": "2",
        };

        if (params.MaxKeys) {
            queryParams["max-keys"] = String(params.MaxKeys);
        }

        if (params.ContinuationToken) {
            queryParams["continuation-token"] = params.ContinuationToken;
        }

        const url = this.buildUrl("", queryParams);
        const response = await this.aws.fetch(url, {
            method: "GET",
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw new Error(`Failed to list objects: ${response.status} ${xmlText}`);
        }

        const xml = parseXml(xmlText);
        const listResult = (xml.ListBucketResult as Record<string, unknown>) || xml;
        const contents = listResult.Contents || (Array.isArray(listResult.Contents) ? listResult.Contents : []);

        return {
            Contents: Array.isArray(contents)
                ? contents.map((item: Record<string, unknown>) => {
                    return {
                        Key: item.Key as string | undefined,
                        LastModified: item.LastModified ? new Date(String(item.LastModified)) : undefined,
                    };
                })
                : [],
            IsTruncated: listResult.IsTruncated === "true" || listResult.IsTruncated === true,
            NextContinuationToken: listResult.NextContinuationToken as string | undefined,
        };
    }

    public async getPresignedUrl(params: { Bucket: string; expiresIn: number; Key: string; PartNumber: number; UploadId: string }): Promise<string> {
        // aws4fetch doesn't have built-in presigned URL support
        // For now, we'll construct a URL that can be signed on-demand
        // Note: This is a limitation - full presigned URL support would require
        // implementing AWS Signature Version 4 query string authentication
        const queryParams: Record<string, string> = {
            partNumber: String(params.PartNumber),
            uploadId: params.UploadId,
            "X-Amz-Expires": String(params.expiresIn),
        };

        const url = this.buildUrl(params.Key, queryParams);

        // TODO: Implement proper presigned URL generation
        // For now, return the URL - actual signing will happen when the request is made
        // This means presigned URLs won't work for clientDirectUpload without additional work
        return url;
    }

    public async putObject(params: {
        Body?: Uint8Array | ReadableStream;
        Bucket: string;
        ContentLength?: number;
        ContentType?: string;
        Key: string;
        Metadata?: Record<string, string>;
    }): Promise<void> {
        const url = this.buildUrl(params.Key);
        const headers: Record<string, string> = {};

        if (params.ContentType) {
            headers["Content-Type"] = params.ContentType;
        }

        if (params.ContentLength !== undefined) {
            headers["Content-Length"] = String(params.ContentLength);
        }

        if (params.Metadata) {
            for (const [key, value] of Object.entries(params.Metadata)) {
                headers[`x-amz-meta-${key}`] = value;
            }
        }

        let body: BodyInit | null | undefined;

        if (params.Body === undefined) {
            body = undefined;
        } else if (params.Body instanceof Uint8Array) {
            body = new Uint8Array(params.Body);
        } else if (params.Body instanceof ReadableStream) {
            body = params.Body;
        } else {
            body = undefined;
        }

        const response = await this.aws.fetch(url, {
            body,
            headers,
            method: "PUT",
        });

        if (!response.ok) {
            const text = await response.text();

            throw new Error(`Failed to put object: ${response.status} ${text}`);
        }
    }

    public async checkBucketAccess(_params: { Bucket: string }): Promise<void> {
        // Simple HEAD request to check bucket access
        const url = this.buildUrl("");
        const response = await this.aws.fetch(url, {
            method: "HEAD",
        });

        if (!response.ok && response.status !== 404) {
            const text = await response.text();

            throw new Error(`Failed to access bucket: ${response.status} ${text}`);
        }
    }

    /**
     * Builds S3 API URL.
     */
    private buildUrl(key: string, queryParams?: Record<string, string>): string {
        const url = new URL(key, this.endpoint);

        if (queryParams) {
            for (const [parameterKey, value] of Object.entries(queryParams)) {
                url.searchParams.set(parameterKey, value);
            }
        }

        return url.toString();
    }

    /**
     * Converts ReadableStream to Readable for Node.js compatibility.
     */
    // eslint-disable-next-line class-methods-use-this
    private streamToReadable(stream: ReadableStream<Uint8Array>): Readable {
        return Readable.fromWeb(stream as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
    }
}

export default AwsLightApiAdapter;
