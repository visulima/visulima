import { UTApi, UTFile } from "uploadthing/server";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { UploadThingStorageOptions } from "./types";
import UploadThingFile from "./uploadthing-file";
import UploadThingMetaStorage from "./uploadthing-meta-storage";

const MAX_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

interface DecodedToken {
    apiKey: string;
    appId: string;
    regions?: string[];
}

const decodeToken = (token: string): DecodedToken => {
    let json: string;

    try {
        json = typeof atob === "function" ? atob(token) : Buffer.from(token, "base64").toString("utf8");
    } catch (error) {
        throw new Error(`UploadThing: token is not valid base64: ${(error as Error).message}`);
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(json);
    } catch (error) {
        throw new Error(`UploadThing: token does not decode to JSON: ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== "object" || typeof (parsed as DecodedToken).apiKey !== "string" || typeof (parsed as DecodedToken).appId !== "string") {
        throw new Error("UploadThing: token missing `apiKey` or `appId`");
    }

    return parsed as DecodedToken;
};

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const basename = (key: string): string => {
    const index = key.lastIndexOf("/");

    return index === -1 ? key : key.slice(index + 1);
};

/* eslint-disable jsdoc/check-indentation -- bullet-list continuations are indented for readability */

/**
 * UploadThing storage backend.
 *
 * Uses `UTApi` from `uploadthing/server`. Uploads via `uploadFiles(UTFile)`,
 * keyed by user-supplied `customId` so subsequent operations (delete, signed
 * URL, list) round-trip on the user's key, not UploadThing's internal fileKey.
 *
 * **Limitations** (mirroring files-sdk):
 * - No native server-side `copy` — implemented as download + re-upload.
 * - `list` has no server-side prefix filter; prefix filtering happens client-
 *   side within a page.
 * - No `responseContentDisposition` override on signed URLs.
 */
class UploadThingStorage extends BaseStorage<UploadThingFile> {
    public static override readonly name: string = "uploadthing";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<UploadThingFile>;

    private readonly acl: "private" | "public-read";

    private readonly appId: string;

    private readonly defaultUrlExpiresIn: number;

    private readonly utapi: UTApi;

    public constructor(config: UploadThingStorageOptions) {
        super(config);

        const token = config.token ?? process.env.UPLOADTHING_TOKEN;

        if (config.client) {
            this.utapi = config.client;
        } else {
            if (!token) {
                throw new Error("UploadThing: missing token. Pass `token` or set UPLOADTHING_TOKEN.");
            }

            this.utapi = new UTApi({ defaultKeyType: "customId", token });
        }

        if (!token) {
            throw new Error("UploadThing: `token` is required even when passing `client` so the adapter can derive `appId` for CDN URLs.");
        }

        this.appId = decodeToken(token).appId;
        this.acl = config.acl ?? "public-read";
        this.defaultUrlExpiresIn = Math.min(config.defaultUrlExpiresIn ?? 3600, MAX_SIGNED_URL_SECONDS);

        this.meta = config.metaStorage ?? new UploadThingMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): UTApi {
        return this.utapi;
    }

    public async create(config: FileInit): Promise<UploadThingFile> {
        return this.instrumentOperation("create", async () => {
            const file = new UploadThingFile(config);

            file.name = this.namingFunction(file);
            file.customId = file.name;

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

    public async write(part: FilePart | FileQuery | UploadThingFile): Promise<UploadThingFile> {
        return this.instrumentOperation("write", async () => {
            let file: UploadThingFile;

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
                    const blob = new Blob([new Uint8Array(buffer)], { type: file.contentType });
                    const utfile = new UTFile([blob], basename(file.name || file.id), {
                        customId: file.name || file.id,
                        type: file.contentType,
                    });

                    const result = await this.utapi.uploadFiles(utfile, { acl: this.acl });

                    if (result.error) {
                        throw new Error(result.error.message);
                    }

                    const { data } = result;

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.ufsKey = data.key;
                    file.url = data.ufsUrl ?? data.url;
                    file.ETag = data.fileHash;
                    file.fileHash = data.fileHash;
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

    public async delete({ id }: FileQuery): Promise<UploadThingFile> {
        return this.instrumentOperation("delete", async () => {
            let file: UploadThingFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata — delete by id as customId
            }

            const key = file?.customId ?? file?.name ?? id;

            await this.utapi.deleteFiles(key);

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new UploadThingFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                customId: key,
                id,
                name: id,
                status: "deleted" as const,
            });
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: UploadThingFile | undefined;
            let key = id;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.customId ?? stored.name ?? id;
            } catch {
                // direct fetch by id
            }

            const url = await this.resolveFetchUrl(key);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`UploadThing: fetch failed: ${response.status} ${response.statusText} for ${key}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());

            return {
                content: buffer,
                contentType: stored?.contentType ?? response.headers.get("content-type") ?? "application/octet-stream",
                ETag: stored?.ETag ?? response.headers.get("etag") ?? undefined,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt,
                name: stored?.name ?? key,
                originalName: stored?.originalName ?? key,
                size: stored?.size ?? buffer.length,
            };
        });
    }

    public async copy(name: string, destination: string): Promise<UploadThingFile> {
        return this.instrumentOperation("copy", async () => {
            const source = await this.get({ id: name });
            const blob = new Blob([new Uint8Array(source.content)], { type: source.contentType });
            const utfile = new UTFile([blob], basename(destination), {
                customId: destination,
                type: source.contentType,
            });

            const result = await this.utapi.uploadFiles(utfile, { acl: this.acl });

            if (result.error) {
                throw new Error(result.error.message);
            }

            const file = new UploadThingFile({
                contentType: source.contentType,
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.customId = destination;
            file.size = typeof source.size === "string" ? Number(source.size) : source.size;
            file.ufsKey = result.data.key;
            file.url = result.data.ufsUrl ?? result.data.url;
            file.ETag = result.data.fileHash;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<UploadThingFile> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination);

            await this.delete({ id: name });

            return file;
        });
    }

    public override async list(limit = 1000): Promise<UploadThingFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const result = await this.utapi.listFiles({ limit });

                return result.files.map((entry) => {
                    const key = entry.customId ?? entry.key;
                    const file = new UploadThingFile({
                        contentType: "application/octet-stream",
                        metadata: {},
                        originalName: key,
                    });

                    file.id = key;
                    file.name = key;
                    file.customId = entry.customId ?? undefined;
                    file.ufsKey = entry.key;
                    file.size = entry.size;
                    file.modifiedAt = entry.uploadedAt ? new Date(entry.uploadedAt).toISOString() : undefined;

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
                "UploadThing: `responseContentDisposition` is not supported — no override exists on UploadThing CDN/signed URLs.",
            );
        }

        if (this.acl === "public-read") {
            return `https://${this.appId}.ufs.sh/f/${encodeURIComponent(key)}`;
        }

        const expiresIn = Math.min(options?.expiresIn ?? this.defaultUrlExpiresIn, MAX_SIGNED_URL_SECONDS);
        const { ufsUrl } = await this.utapi.generateSignedURL(key, {
            expiresIn,
            keyType: "customId",
        });

        return ufsUrl;
    }

    // eslint-disable-next-line class-methods-use-this -- override of the base contract; signals "not supported" without instance state
    public override async getUploadUrl(_key: string, _options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        // Signed PUT URLs for UploadThing require HMAC signing over a UFS
        // ingest endpoint — out of scope for this adapter. Callers that need
        // direct-from-browser uploads should use UploadThing's file-router
        // pattern via the `raw` escape hatch.
        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "UploadThing: presigned PUT URLs require the UFS ingest signing scheme — use the file-router pattern via `storage.raw` instead.",
        );
    }

    private async resolveFetchUrl(key: string): Promise<string> {
        if (this.acl === "public-read") {
            return `https://${this.appId}.ufs.sh/f/${encodeURIComponent(key)}`;
        }

        const { ufsUrl } = await this.utapi.generateSignedURL(key, {
            expiresIn: this.defaultUrlExpiresIn,
            keyType: "customId",
        });

        return ufsUrl;
    }

    private internalOnComplete = (file: UploadThingFile): Promise<void> => this.deleteMeta(file.id);
}

export default UploadThingStorage;
