import { Readable } from "node:stream";

import { BaseStorage } from "../storage/storage";
import type { File as StorageFile, FilePart } from "../storage/utils/file";

/**
 * Web-standard and Node-native body types accepted by {@link Files.upload}.
 */
export type FileBody = ArrayBuffer | ArrayBufferView | Blob | Buffer | NodeJS.ReadableStream | ReadableStream<Uint8Array> | string;

export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, unknown>;

    /**
     * Explicit byte length. Required for {@link NodeJS.ReadableStream} and Web `ReadableStream`
     * inputs because their length is not derivable from the value itself; ignored otherwise.
     */
    size?: number;
    storageClass?: string;
}

export interface SignedReadUrlOptions {
    expiresIn?: number;
    responseContentDisposition?: string;
    responseContentType?: string;
}

export interface SignedUploadUrlOptions {
    contentLength?: number;
    contentType?: string;
    expiresIn?: number;
}

export interface ListOptions {
    limit?: number;
    prefix?: string;
}

/**
 * Provider-agnostic metadata-only view of an object.
 */
export interface FileObject {
    contentType: string;
    etag?: string;
    key: string;
    lastModified?: Date | number | string;
    metadata?: Record<string, unknown>;
    size?: number;
}

export interface DownloadResult extends FileObject {
    body: Buffer;
}

export interface FilesOptions<TStorage extends BaseStorage = BaseStorage> {
    adapter: TStorage;
}

const isWebReadableStream = (value: unknown): value is ReadableStream<Uint8Array> =>
    typeof value === "object" && value !== null && typeof (value as { getReader?: unknown }).getReader === "function";

const isNodeReadable = (value: unknown): value is NodeJS.ReadableStream =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { pipe?: unknown }).pipe === "function" &&
    typeof (value as { read?: unknown }).read === "function";

/**
 * Normalizes any supported body into a Node `Readable` + a known size when derivable.
 */
const normalizeBody = async (body: FileBody, sizeHint?: number): Promise<{ size?: number; stream: Readable }> => {
    if (typeof body === "string") {
        const buffer = Buffer.from(body);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (Buffer.isBuffer(body)) {
        return { size: body.byteLength, stream: Readable.from(body) };
    }

    if (body instanceof Uint8Array) {
        const buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (body instanceof ArrayBuffer) {
        const buffer = Buffer.from(body);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (ArrayBuffer.isView(body)) {
        const view = body;
        const buffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (typeof Blob !== "undefined" && body instanceof Blob) {
        return { size: body.size, stream: Readable.fromWeb(body.stream() as unknown as Parameters<typeof Readable.fromWeb>[0]) };
    }

    if (isWebReadableStream(body)) {
        return { size: sizeHint, stream: Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]) };
    }

    if (isNodeReadable(body)) {
        return { size: sizeHint, stream: body as Readable };
    }

    throw new TypeError(`Unsupported body type: ${Object.prototype.toString.call(body)}`);
};

const toFileObject = (file: StorageFile, fallbackKey?: string): FileObject => {
    return {
        contentType: file.contentType ?? "application/octet-stream",
        etag: file.ETag,
        key: file.name || file.id || fallbackKey || "",
        lastModified: file.modifiedAt ?? file.createdAt,
        metadata: file.metadata,
        size: typeof file.size === "number" ? file.size : undefined,
    };
};

/**
 * Files-SDK–style unified facade over a {@link BaseStorage} instance.
 *
 * Provides a small, consistent surface (`upload`, `download`, `head`, `exists`, `delete`, `copy`,
 * `list`, `url`, `signedUploadUrl`) and a `raw` escape hatch to the adapter's native client.
 *
 * The facade uses the user-supplied `key` as both the storage path and the metadata id,
 * so subsequent operations look up the object by the same key that was used to upload it.
 * @example
 * ```ts
 * import { Files, S3Storage } from "@visulima/storage";
 *
 * const files = new Files({
 *   adapter: new S3Storage({ bucket: "uploads", region: "us-east-1" }),
 * });
 *
 * await files.upload("avatars/abc.png", buffer, { contentType: "image/png" });
 * const head = await files.head("avatars/abc.png");
 * const url = await files.url("avatars/abc.png", { expiresIn: 900 });
 * ```
 */
export class Files<TStorage extends BaseStorage = BaseStorage> {
    public readonly adapter: TStorage;

    public constructor(options: FilesOptions<TStorage>) {
        this.adapter = options.adapter;
    }

    /**
     * Escape hatch to the adapter's native client (S3Client, BlobServiceClient, ...).
     * Typed via the `TStorage` parameter, so pinning the adapter type at construction yields a
     * typed view of the native client. Returns `undefined` when the adapter has no native client
     * (e.g. DiskStorage).
     */
    public get raw(): TStorage["raw"] {
        return this.adapter.raw;
    }

    public async upload(key: string, body: FileBody, options: UploadOptions = {}): Promise<FileObject> {
        BaseStorage.assertSafeId(key);

        const { size: normalizedSize, stream } = await normalizeBody(body, options.size);
        const size = options.size ?? normalizedSize;

        const userMetadata = options.metadata ?? {};
        const metadata = {
            ...userMetadata,
            name: key,
            ...(options.contentType ? { type: options.contentType } : {}),
            ...(size === undefined ? {} : { size }),
        };

        const file = await this.adapter.create({
            contentType: options.contentType,
            id: key,
            metadata,
            originalName: key,
            size,
            storageClass: options.storageClass,
        });

        const part: FilePart = {
            body: stream,
            contentLength: size,
            id: file.id,
            start: 0,
        };

        const written = await this.adapter.write(part);

        return toFileObject(written, key);
    }

    public async download(key: string): Promise<DownloadResult> {
        BaseStorage.assertSafeId(key);

        const file = await this.adapter.get({ id: key });

        return {
            body: file.content,
            contentType: file.contentType ?? "application/octet-stream",
            etag: file.ETag,
            key,
            lastModified: file.modifiedAt,
            metadata: file.metadata,
            size: typeof file.size === "number" ? file.size : undefined,
        };
    }

    public async head(key: string): Promise<FileObject> {
        BaseStorage.assertSafeId(key);

        const file = await this.adapter.getMeta(key);

        return toFileObject(file, key);
    }

    /**
     * Resolves to `true` when an object exists at `key`, `false` otherwise. Never throws for a
     * missing object.
     */
    public async exists(key: string): Promise<boolean> {
        BaseStorage.assertSafeId(key);

        return this.adapter.exists({ id: key });
    }

    public async delete(key: string): Promise<void> {
        BaseStorage.assertSafeId(key);

        await this.adapter.delete({ id: key });
    }

    public async copy(source: string, destination: string, options?: { storageClass?: string }): Promise<FileObject> {
        BaseStorage.assertSafeId(source);
        BaseStorage.assertSafeId(destination);

        const file = await this.adapter.copy(source, destination, options);

        return toFileObject(file, destination);
    }

    public async list(options: ListOptions = {}): Promise<FileObject[]> {
        const files = await this.adapter.list(options.limit ?? 1000);
        const mapped = files.map((file) => {
            const object = toFileObject(file);

            // DiskStorage returns paths with a leading "/" relative to its directory; strip it so keys match user input.
            if (object.key.startsWith("/")) {
                object.key = object.key.slice(1);
            }

            return object;
        });

        if (options.prefix) {
            return mapped.filter((file) => file.key.startsWith(options.prefix as string));
        }

        return mapped;
    }

    public async url(key: string, options?: SignedReadUrlOptions): Promise<string> {
        BaseStorage.assertSafeId(key);

        return this.adapter.getReadUrl(key, options);
    }

    public async signedUploadUrl(key: string, options?: SignedUploadUrlOptions): Promise<string> {
        BaseStorage.assertSafeId(key);

        return this.adapter.getUploadUrl(key, options);
    }
}

export default Files;
