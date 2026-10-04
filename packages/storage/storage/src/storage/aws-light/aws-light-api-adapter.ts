import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { AwsClient } from "aws4fetch";

import type { MultipartUpload, Part, S3ApiOperations, S3CallOptions } from "../aws/s3-api";
import type { AwsLightClientConfig } from "./types";

const XML_ENTITIES: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

/** Decodes the predefined XML entities and numeric character references. */
const decodeXmlText = (text: string): string =>
    text.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, name: string) => {
        if (name.startsWith("#x") || name.startsWith("#X")) {
            return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
        }

        if (name.startsWith("#")) {
            return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
        }

        return XML_ENTITIES[name] ?? entity;
    });

/**
 * Minimal XML parser for S3 API responses. An element with child elements becomes an object, one
 * with only text becomes its (trimmed, decoded) text, and repeated sibling elements (`&lt;Part>`,
 * `&lt;Contents>`, `&lt;CommonPrefixes>`) become an array. Empty elements are left out. A single linear
 * scan, so no regex backtracking on the response.
 */
export const parseXml = (text: string): Record<string, unknown> => {
    let position = 0;

    const parseContent = (): Record<string, unknown> | string => {
        const element: Record<string, unknown> = {};
        let content = "";
        let hasChildren = false;

        while (position < text.length) {
            const tagStart = text.indexOf("<", position);

            if (tagStart === -1) {
                content += text.slice(position);
                position = text.length;
                break;
            }

            content += text.slice(position, tagStart);

            if (text.startsWith("<![CDATA[", tagStart)) {
                const end = text.indexOf("]]>", tagStart);
                const stop = end === -1 ? text.length : end;

                // CDATA is literal text: keep it apart from entity decoding by escaping its ampersands.
                content += text.slice(tagStart + 9, stop).replaceAll("&", "&amp;");
                position = stop + 3;
                continue;
            }

            const tagEnd = text.indexOf(">", tagStart);

            if (tagEnd === -1) {
                position = text.length;
                break;
            }

            position = tagEnd + 1;

            // Closing tag of the element being parsed.
            if (text[tagStart + 1] === "/") {
                break;
            }

            // XML declaration, comment or doctype.
            if (text[tagStart + 1] === "?" || text[tagStart + 1] === "!") {
                continue;
            }

            const tag = text.slice(tagStart + 1, tagEnd);
            const selfClosing = tag.endsWith("/");
            const [name] = (selfClosing ? tag.slice(0, -1) : tag).trim().split(/\s/u);
            const value = selfClosing ? "" : parseContent();

            hasChildren = true;

            if (!name || value === "") {
                continue;
            }

            const existing = element[name];

            if (existing === undefined) {
                element[name] = value;
            } else if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                element[name] = [existing, value];
            }
        }

        return hasChildren ? element : decodeXmlText(content.trim());
    };

    const root = parseContent();

    return typeof root === "string" ? {} : root;
};

/** A repeated XML element as an array: absent → [], a single element → [element]. */
const toArray = <T>(value: unknown): T[] => {
    if (value === undefined) {
        return [];
    }

    return (Array.isArray(value) ? value : [value]) as T[];
};

/**
 * An error for a failed S3 request, carrying the HTTP status in both shapes the storage reads
 * (`statusCode` for retries, `$metadata.httpStatusCode` like the AWS SDK) and the S3 error code.
 */
const requestError = (message: string, status: number, body: string): Error => {
    const code = (parseXml(body).Error as Record<string, unknown> | undefined)?.Code;

    return Object.assign(new Error(`${message}: ${String(status)} ${body}`), {
        $metadata: { httpStatusCode: status },
        statusCode: status,
        ...(typeof code === "string" && { code, name: code }),
    });
};

/**
 * Adapter that uses aws4fetch to implement S3ApiOperations interface.
 */
class AwsLightApiAdapter implements S3ApiOperations {
    public aws: AwsClient;

    private readonly bucket: string;

    /** Bucket URL without a trailing slash; object keys are appended to it. */
    private readonly baseUrl: string;

    public constructor(config: AwsLightClientConfig & { bucket: string }) {
        this.bucket = config.bucket;

        const endpoint = new URL(config.endpoint || `https://${config.bucket}.s3.${config.region}.amazonaws.com`);
        let path = endpoint.pathname.replace(/\/+$/u, "");

        // A custom endpoint is the service root (path-style, as for R2, MinIO and Spaces) unless it
        // already names the bucket, in its host (virtual-hosted) or as its last path segment.
        if (!endpoint.hostname.startsWith(`${config.bucket}.`) && path.split("/").pop() !== config.bucket) {
            path += `/${encodeURIComponent(config.bucket)}`;
        }

        this.baseUrl = endpoint.origin + path;

        this.aws = new AwsClient({
            accessKeyId: config.accessKeyId,
            region: config.region,
            secretAccessKey: config.secretAccessKey,
            service: config.service || "s3",
            sessionToken: config.sessionToken,
        });
    }

    public async createMultipartUpload(
        params: {
            ACL?: string;
            Bucket: string;
            ContentType?: string;
            Key: string;
            Metadata?: Record<string, string>;
        },
        options?: S3CallOptions,
    ): Promise<{ UploadId: string }> {
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
            signal: options?.signal,
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw requestError("Failed to create multipart upload", response.status, xmlText);
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

    public async uploadPart(
        params: {
            Body: Readable | ReadableStream | Uint8Array;
            Bucket: string;
            ContentLength?: number;
            ContentMD5?: string;
            Key: string;
            PartNumber: number;
            UploadId: string;
        },
        options?: S3CallOptions,
    ): Promise<{ ETag: string }> {
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

        // Convert Node.js Readable to ReadableStream if needed
        const body: BodyInit =
            params.Body instanceof Readable ? (Readable.toWeb(params.Body) as unknown as ReadableStream<Uint8Array>) : (params.Body as BodyInit);

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            body,
            headers,
            method: "PUT",
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to upload part", response.status, text);
        }

        // Note: Response body is consumed by the fetch, so we don't need to read it for successful PUT requests

        const etag = response.headers.get("ETag");

        if (!etag) {
            throw new Error("Failed to get ETag from response");
        }

        // Remove quotes from ETag
        return { ETag: etag.replaceAll(/(^"|"$)/g, "") };
    }

    public async completeMultipartUpload(
        params: {
            Bucket: string;
            IfMatch?: string;
            IfNoneMatch?: string;
            Key: string;
            Parts: { ETag: string; PartNumber: number }[];
            UploadId: string;
        },
        options?: S3CallOptions,
    ): Promise<{ ETag?: string; Location: string }> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };

        // Build XML body for complete multipart upload
        const partsXml = params.Parts.map(({ ETag, PartNumber }) => `<Part><PartNumber>${PartNumber}</PartNumber><ETag>"${ETag}"</ETag></Part>`).join("");

        // XML template string - false positive for entropy detection

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${partsXml}
</CompleteMultipartUpload>`;

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            body: xmlBody,
            headers: {
                "Content-Type": "application/xml",
                ...(params.IfMatch !== undefined && { "If-Match": params.IfMatch }),
                ...(params.IfNoneMatch !== undefined && { "If-None-Match": params.IfNoneMatch }),
            },
            method: "POST",
            signal: options?.signal,
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw requestError("Failed to complete multipart upload", response.status, xmlText);
        }

        const xml = parseXml(xmlText);

        // S3 can answer 200 and still fail the request, with an <Error> body; such errors are
        // server-side (InternalError, SlowDown), so report them as a retryable 500.
        if (xml.Error !== undefined) {
            throw requestError("Failed to complete multipart upload", 500, xmlText);
        }

        const result = (xml.CompleteMultipartUploadResult as Record<string, unknown>) || xml;

        const location = (result.Location as string) || this.buildUrl(params.Key);
        const etag = result.ETag as string | undefined;

        return {
            ETag: etag?.replaceAll(/(^"|"$)/g, ""),
            Location: location,
        };
    }

    public async abortMultipartUpload(params: { Bucket: string; Key: string; UploadId: string }, options?: S3CallOptions): Promise<void> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };
        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            method: "DELETE",
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to abort multipart upload", response.status, text);
        }
    }

    public async listMultipartUploads(
        params: { Bucket: string; KeyMarker?: string; UploadIdMarker?: string },
        options?: S3CallOptions,
    ): Promise<{ IsTruncated?: boolean; NextKeyMarker?: string; NextUploadIdMarker?: string; Uploads?: MultipartUpload[] }> {
        const queryParams: Record<string, string> = { uploads: "" };

        if (params.KeyMarker !== undefined) {
            queryParams["key-marker"] = params.KeyMarker;
        }

        if (params.UploadIdMarker !== undefined) {
            queryParams["upload-id-marker"] = params.UploadIdMarker;
        }

        const response = await this.aws.fetch(this.buildUrl("", queryParams), { method: "GET", signal: options?.signal });
        const xmlText = await response.text();

        if (!response.ok) {
            throw requestError("Failed to list multipart uploads", response.status, xmlText);
        }

        const xml = parseXml(xmlText);
        const result = (xml.ListMultipartUploadsResult as Record<string, unknown> | undefined) ?? xml;

        return {
            IsTruncated: result.IsTruncated === "true",
            NextKeyMarker: result.NextKeyMarker as string | undefined,
            NextUploadIdMarker: result.NextUploadIdMarker as string | undefined,
            Uploads: toArray<Record<string, unknown>>(result.Upload).map((upload) => {
                return {
                    Initiated: upload.Initiated ? new Date(String(upload.Initiated)) : undefined,
                    Key: upload.Key as string | undefined,
                    UploadId: upload.UploadId as string | undefined,
                };
            }),
        };
    }

    public async listParts(
        params: { Bucket: string; Key: string; PartNumberMarker?: string; UploadId: string },
        options?: S3CallOptions,
    ): Promise<{ IsTruncated?: boolean; NextPartNumberMarker?: string; Parts?: Part[] }> {
        const queryParams: Record<string, string> = { uploadId: params.UploadId };

        if (params.PartNumberMarker !== undefined) {
            queryParams["part-number-marker"] = params.PartNumberMarker;
        }

        const url = this.buildUrl(params.Key, queryParams);
        const response = await this.aws.fetch(url, {
            method: "GET",
            signal: options?.signal,
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw requestError("Failed to list parts", response.status, xmlText);
        }

        const xml = parseXml(xmlText);
        const listPartsResult = (xml.ListPartsResult as Record<string, unknown> | undefined) ?? xml;

        return {
            IsTruncated: listPartsResult.IsTruncated === "true" || listPartsResult.IsTruncated === true,
            NextPartNumberMarker: listPartsResult.NextPartNumberMarker === undefined ? undefined : String(listPartsResult.NextPartNumberMarker),
            Parts: toArray<Record<string, unknown>>(listPartsResult.Part).map((part) => {
                return {
                    ETag: (part.ETag as string)?.replaceAll(/(^"|"$)/g, ""),
                    PartNumber: Number(part.PartNumber) || 0,
                    Size: part.Size ? Number(part.Size) : undefined,
                };
            }),
        };
    }

    public async getObject(
        params: { Bucket: string; IfMatch?: string; Key: string; Range?: string },
        options?: S3CallOptions,
    ): Promise<{
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
            headers: {
                ...(params.IfMatch !== undefined && { "If-Match": params.IfMatch }),
                ...(params.Range !== undefined && { Range: params.Range }),
            },
            method: "GET",
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to get object", response.status, text);
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
            ETag: etag?.replaceAll(/(^"|"$)/g, "") || undefined,
            Expires: expires ? new Date(expires) : undefined,
            LastModified: lastModified ? new Date(lastModified) : undefined,
            Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    public async headObject(
        params: { Bucket: string; Key: string },
        options?: S3CallOptions,
    ): Promise<{
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
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            // The status in the SDK's shape, so callers can tell a missing object from a failure.
            throw requestError("Failed to head object", response.status, text);
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
            ETag: etag?.replaceAll(/(^"|"$)/g, "") || undefined,
            Expires: expires ? new Date(expires) : undefined,
            LastModified: lastModified ? new Date(lastModified) : undefined,
            Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    public async deleteObject(params: { Bucket: string; IfMatch?: string; Key: string }, options?: S3CallOptions): Promise<void> {
        const url = this.buildUrl(params.Key);
        const response = await this.aws.fetch(url, {
            ...(params.IfMatch !== undefined && { headers: { "If-Match": params.IfMatch } }),
            method: "DELETE",
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to delete object", response.status, text);
        }
    }

    public async copyObject(
        params: { Bucket: string; CopySource: string; CopySourceIfMatch?: string; IfMatch?: string; IfNoneMatch?: string; Key: string; StorageClass?: string },
        options?: S3CallOptions,
    ): Promise<void> {
        const headers: Record<string, string> = {
            "x-amz-copy-source": params.CopySource,
            ...(params.CopySourceIfMatch !== undefined && { "x-amz-copy-source-if-match": params.CopySourceIfMatch }),
            ...(params.IfMatch !== undefined && { "If-Match": params.IfMatch }),
            ...(params.IfNoneMatch !== undefined && { "If-None-Match": params.IfNoneMatch }),
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
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to copy object", response.status, text);
        }
    }

    public async listObjectsV2(
        params: { Bucket: string; ContinuationToken?: string; Delimiter?: string; MaxKeys?: number; Prefix?: string },
        options?: S3CallOptions,
    ): Promise<{
        CommonPrefixes?: { Prefix?: string }[];
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

        if (params.Delimiter !== undefined) {
            queryParams.delimiter = params.Delimiter;
        }

        if (params.Prefix !== undefined) {
            queryParams.prefix = params.Prefix;
        }

        const url = this.buildUrl("", queryParams);
        const response = await this.aws.fetch(url, {
            method: "GET",
            signal: options?.signal,
        });

        const xmlText = await response.text();

        if (!response.ok) {
            throw requestError("Failed to list objects", response.status, xmlText);
        }

        const xml = parseXml(xmlText);
        const listResult = (xml.ListBucketResult as Record<string, unknown> | undefined) ?? xml;

        return {
            CommonPrefixes: toArray<Record<string, unknown>>(listResult.CommonPrefixes).map((prefix) => {
                return { Prefix: prefix.Prefix as string | undefined };
            }),
            Contents: toArray<Record<string, unknown>>(listResult.Contents).map((item) => {
                return {
                    Key: item.Key as string | undefined,
                    LastModified: item.LastModified ? new Date(String(item.LastModified)) : undefined,
                };
            }),
            IsTruncated: listResult.IsTruncated === "true" || listResult.IsTruncated === true,
            NextContinuationToken: listResult.NextContinuationToken as string | undefined,
        };
    }

    /** A SigV4 query-signed `PUT` URL for one part, usable without credentials until it expires. */
    public async getPresignedUrl(params: { Bucket: string; expiresIn: number; Key: string; PartNumber: number; UploadId: string }): Promise<string> {
        const url = this.buildUrl(params.Key, {
            partNumber: String(params.PartNumber),
            uploadId: params.UploadId,
            "X-Amz-Expires": String(params.expiresIn),
        });
        const signed = await this.aws.sign(url, { aws: { signQuery: true }, method: "PUT" });

        return signed.url;
    }

    public async putObject(params: {
        Body?: Uint8Array | ReadableStream;
        Bucket: string;
        ContentLength?: number;
        ContentType?: string;
        /** Conditional write: only replace the object while it still has this ETag. */
        IfMatch?: string;
        Key: string;
        Metadata?: Record<string, string>;
    }): Promise<{ ETag?: string }> {
        const url = this.buildUrl(params.Key);
        const headers: Record<string, string> = {};

        if (params.IfMatch !== undefined) {
            headers["If-Match"] = params.IfMatch.startsWith('"') ? params.IfMatch : `"${params.IfMatch}"`;
        }

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

            throw requestError("Failed to put object", response.status, text);
        }

        return { ETag: response.headers?.get("ETag")?.replaceAll(/(^"|"$)/g, "") || undefined };
    }

    public async checkBucketAccess(_params: { Bucket: string }): Promise<void> {
        // HEAD on the bucket: a 404 means it doesn't exist, which must fail the startup check.
        const url = this.buildUrl("");
        const response = await this.aws.fetch(url, {
            method: "HEAD",
        });

        if (!response.ok) {
            const text = await response.text();

            throw requestError("Failed to access bucket", response.status, text);
        }
    }

    /**
     * Builds S3 API URL.
     */
    private buildUrl(key: string, queryParams?: Record<string, string>): string {
        const segments = key.split("/");

        // URLs resolve "." and ".." segments (even percent-encoded), so such a key would address another object.
        if (segments.some((segment) => segment === "." || segment === "..")) {
            throw new Error(`Object key "${key}" cannot be addressed: it contains a "." or ".." segment`);
        }

        const url = new URL(`${this.baseUrl}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`);

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
        return Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>);
    }
}

export default AwsLightApiAdapter;
