import * as BunnyStorageSDK from "@bunny.net/storage-sdk";

import type { UploadError } from "../../utils/errors";
import { ERRORS, throwErrorCode, wrapStorageError } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import BunnyFile from "./bunny-file";
import BunnyMetaStorage from "./bunny-meta-storage";
import type { BunnyStorageClient, BunnyStorageOptions, BunnyStorageRegion } from "./types";

const VALID_REGIONS = new Set<string>(Object.values(BunnyStorageSDK.regions.StorageRegion));

type BunnyUploadStream = Parameters<typeof BunnyStorageSDK.file.upload>[2];

const toBunnyPath = (key: string): string => `/${key.replace(/^\/+/u, "")}`;

const fromBunnyPath = (path: string): string => path.replace(/^\/+/u, "");

const joinPublicUrl = (base: string, key: string): string => {
    const trimmedBase = base.replace(/\/+$/u, "");
    const trimmedKey = key.replace(/^\/+/u, "");

    return `${trimmedBase}/${trimmedKey}`;
};

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const streamFromBuffer = (buffer: Buffer): BunnyUploadStream => {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new Uint8Array(buffer));
            controller.close();
        },
    });

    return stream as unknown as BunnyUploadStream;
};

const parseRegion = (region: string | undefined): BunnyStorageRegion | undefined => {
    if (!region) {
        return undefined;
    }

    if (!VALID_REGIONS.has(region)) {
        throw new Error(`Bunny Storage: unsupported region "${region}". Pass one of ${[...VALID_REGIONS].join(", ")}.`);
    }

    return region as BunnyStorageRegion;
};

const resolveClient = (config: BunnyStorageOptions): BunnyStorageClient => {
    if (config.client) {
        return config.client;
    }

    const zone = config.zone ?? process.env.BUNNY_STORAGE_ZONE ?? process.env.STORAGE_ZONE;
    const accessKey = config.accessKey ?? process.env.BUNNY_STORAGE_ACCESS_KEY ?? process.env.BUNNY_ACCESS_KEY ?? process.env.STORAGE_ACCESS_KEY;
    const region = parseRegion(config.region ?? process.env.BUNNY_STORAGE_REGION ?? process.env.STORAGE_REGION);

    if (!zone || !accessKey || !region) {
        throw new Error(
            "Bunny Storage: missing credentials. Pass `zone` + `accessKey` + `region`, or set BUNNY_STORAGE_ZONE / BUNNY_STORAGE_ACCESS_KEY / BUNNY_STORAGE_REGION (SDK aliases: STORAGE_ZONE / STORAGE_ACCESS_KEY / STORAGE_REGION).",
        );
    }

    return BunnyStorageSDK.zone.connect_with_accesskey(region as BunnyStorageSDK.regions.StorageRegion, zone, accessKey);
};

const collectFromWebStream = async (stream: unknown): Promise<Buffer> => Buffer.from(await new Response(stream as BodyInit).arrayBuffer());

/**
 * Map a `@bunny.net/storage-sdk` thrown error into an `UploadError`.
 *
 * The SDK's internal helper (`u()` in `lib.mjs`) throws plain `Error` objects
 * with status-dependent message text and no `.status` / `.statusCode`
 * properties. We infer the canonical error code from the message:
 *
 * - `"File not found: ..."`              → 404 → FILE_NOT_FOUND
 * - `"Unable to upload file. ..."`       → 400 → BAD_REQUEST
 * - `"Unauthorized access to ..."`       → 401 → FORBIDDEN
 * - everything else (incl. fetch errors) → STORAGE_ERROR via wrapStorageError
 */
const wrapBunnyError = (error: unknown, operation: string): UploadError => {
    const nativeMessage = (error as { message?: unknown } | null)?.message;
    const message = typeof nativeMessage === "string" ? nativeMessage : "";

    if (/^file not found/iu.test(message)) {
        return wrapStorageError(error, { adapter: "Bunny Storage", operation, status: 404 });
    }

    if (/^unauthorized access/iu.test(message)) {
        return wrapStorageError(error, { adapter: "Bunny Storage", operation, status: 401 });
    }

    if (/^unable to upload file/iu.test(message)) {
        return wrapStorageError(error, { adapter: "Bunny Storage", operation, status: 400 });
    }

    return wrapStorageError(error, { adapter: "Bunny Storage", operation });
};

/**
 * Bunny Storage backend.
 *
 * Uses `@bunny.net/storage-sdk`. Writes go through the Storage API with an `AccessKey` header; reads either go through `data()` (server-side fetch) or, when a public Pull Zone is configured, through `publicBaseUrl`.
 *
 * **Limitations**:
 *
 * - No native server-side `copy` — implemented as download + re-upload.
 * - No `signedUploadUrl` / presigned PUT — Bunny has no such primitive.
 * - `getReadUrl` requires `publicBaseUrl` (Pull Zone / CDN hostname) and returns an unsigned URL — Bunny has no signed-read URL primitive, so `expiresIn` is accepted for parity with other adapters but ignored.
 * - `getReadUrl` rejects `responseContentDisposition` — no override exists on Bunny Storage / Pull Zone URLs.
 * - `list` is non-recursive: `BunnyStorageSDK.file.list(client, "/")` returns only the immediate children of the zone root. Directory entries are filtered out client-side; the adapter does not descend.
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */
class BunnyStorage extends BaseStorage<BunnyFile> {
    public static override readonly name: string = "bunny";

    public override checksumTypes: string[] = ["SHA256"];

    protected meta: MetaStorage<BunnyFile>;

    private readonly client: BunnyStorageClient;

    private readonly publicBaseUrl: string | undefined;

    private readonly zoneName: string;

    public constructor(config: BunnyStorageOptions) {
        super(config);

        this.client = resolveClient(config);
        this.zoneName = BunnyStorageSDK.zone.name(this.client);
        this.publicBaseUrl = config.publicBaseUrl;

        this.meta = config.metaStorage ?? new BunnyMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): BunnyStorageClient {
        return this.client;
    }

    /** Name of the connected Bunny Storage zone. */
    public get zone(): string {
        return this.zoneName;
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<BunnyFile> {
        return this.instrumentOperation("create", async () => {
            const file = new BunnyFile(config);

            file.name = this.namingFunction(file);
            file.bunnyPath = toBunnyPath(file.name);

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // new upload
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | BunnyFile, options?: OperationOptions): Promise<BunnyFile> {
        return this.instrumentOperation("write", async () => {
            let file: BunnyFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                file = part;
            } else {
                file = await this.getMeta(part.id);
                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (part.size !== undefined) {
                updateSize(file, part.size);
            }

            if (!partMatch(part, file)) {
                throw new Error("File part does not match");
            }

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        throw new Error("Unsupported checksum algorithm");
                    }

                    const buffer = await collectStream(part.body);
                    const path = toBunnyPath(file.name || file.id);

                    try {
                        await this.runOperation(options, () =>
                            BunnyStorageSDK.file.upload(this.client, path, streamFromBuffer(buffer), {
                                contentType: file.contentType,
                                ...(part.checksum && part.checksumAlgorithm === "sha256" && { sha256Checksum: part.checksum }),
                            }),
                        );
                    } catch (error) {
                        throw wrapBunnyError(error, "upload");
                    }

                    // The SDK's `upload` returns `boolean`, not the resulting
                    // StorageFile. checksum / lastChanged are only available
                    // via a follow-up GET; rather than doubling the request
                    // count per write, callers that need them can re-fetch
                    // via `get()` or `getMeta()` after the upload completes.
                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.bunnyPath = path;
                }

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    await this.internalOnComplete(file);
                }

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<BunnyFile> {
        return this.instrumentOperation("delete", async () => {
            let file: BunnyFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata — delete by id as path
            }

            const path = file?.bunnyPath ?? toBunnyPath(file?.name ?? id);

            // The Bunny SDK's `remove` returns `(await fetch(...)).ok` —
            // `true` on 2xx, `false` on any non-2xx (incl. 404). It only
            // throws on network errors. We treat `false` as "best-effort
            // delete" (missing-or-failed) since the response status is
            // unrecoverable from the boolean; idempotent delete is the
            // intended contract here.
            try {
                await this.runOperation(options, () => BunnyStorageSDK.file.remove(this.client, path));
            } catch (error) {
                throw wrapBunnyError(error, "delete");
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            const synthetic = new BunnyFile({ contentType: "application/octet-stream", metadata: {}, originalName: id });

            synthetic.id = id;
            synthetic.name = id;
            synthetic.bunnyPath = path;
            synthetic.status = "deleted";

            return synthetic;
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: BunnyFile | undefined;
            let path: string;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                path = stored.bunnyPath ?? toBunnyPath(stored.name ?? id);
            } catch {
                path = toBunnyPath(id);
            }

            let entry: BunnyStorageSDK.file.StorageFile;

            try {
                entry = await this.runOperation(options, () => BunnyStorageSDK.file.get(this.client, path));
            } catch (error) {
                throw wrapBunnyError(error, "get");
            }

            let buffer: Buffer;

            try {
                const result = await this.runOperation(options, () => entry.data());

                buffer = await collectFromWebStream(result.stream);
            } catch (error) {
                throw wrapBunnyError(error, "download");
            }

            return {
                content: buffer,
                contentType: stored?.contentType ?? entry.contentType ?? "application/octet-stream",
                ETag: stored?.ETag ?? entry.checksum ?? undefined,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? entry.lastChanged?.toISOString(),
                name: stored?.name ?? fromBunnyPath(path),
                originalName: stored?.originalName ?? fromBunnyPath(path),
                size: stored?.size ?? entry.length ?? buffer.length,
            };
        });
    }

    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<BunnyFile> {
        return this.instrumentOperation("copy", async () => {
            const source = await this.get({ id: name }, options);
            const path = toBunnyPath(destination);
            const buffer = source.content;
            const size = typeof source.size === "string" ? Number(source.size) : (source.size ?? buffer.length);

            try {
                await this.runOperation(options, () =>
                    BunnyStorageSDK.file.upload(this.client, path, streamFromBuffer(buffer), {
                        contentType: source.contentType,
                    }),
                );
            } catch (error) {
                throw wrapBunnyError(error, "copy");
            }

            const file = new BunnyFile({
                contentType: source.contentType,
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.bunnyPath = path;
            file.size = size;
            file.ETag = source.ETag;
            file.bunnyChecksum = source.ETag;

            return file;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<BunnyFile> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination, options);

            await this.delete({ id: name }, options);

            return file;
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<BunnyFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                let entries: BunnyStorageSDK.file.StorageFile[];

                try {
                    entries = await this.runOperation(options, () => BunnyStorageSDK.file.list(this.client, "/"));
                } catch (error) {
                    throw wrapBunnyError(error, "list");
                }

                return entries
                    .filter((entry) => !entry.isDirectory)
                    .slice(0, limit)
                    .map((entry) => {
                        const path =
                            entry.path.endsWith(entry.objectName) || !entry.objectName ? entry.path : `${entry.path.replace(/\/+$/u, "")}/${entry.objectName}`;
                        const key = fromBunnyPath(path);
                        const file = new BunnyFile({
                            contentType: entry.contentType || "application/octet-stream",
                            metadata: {},
                            originalName: key,
                        });

                        file.id = key;
                        file.name = key;
                        file.bunnyPath = toBunnyPath(key);
                        file.bunnyChecksum = entry.checksum ?? undefined;
                        file.ETag = entry.checksum ?? undefined;
                        file.size = entry.length;
                        file.modifiedAt = entry.lastChanged?.toISOString();

                        return file;
                    });
            },
            { limit },
        );
    }

    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        if (options?.responseContentDisposition) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Bunny Storage: `responseContentDisposition` is not supported — no override exists on Bunny Storage / Pull Zone URLs.",
            );
        }

        if (!this.publicBaseUrl) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Bunny Storage: `getReadUrl` requires `publicBaseUrl` (for example a Bunny Pull Zone or custom CDN hostname). The Storage API URL itself requires an AccessKey header and cannot be handed out as a public URL.",
            );
        }

        return joinPublicUrl(this.publicBaseUrl, key);
    }

    // eslint-disable-next-line class-methods-use-this -- override of the base contract; signals "not supported" without instance state
    public override async getUploadUrl(_key: string, _options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "Bunny Storage: presigned PUT URLs are not supported — writes go through the Storage API with an AccessKey header. Upload server-side via the SDK or proxy through your application.",
        );
    }

    private internalOnComplete = (file: BunnyFile): Promise<void> => this.deleteMeta(file.id);
}

export default BunnyStorage;
