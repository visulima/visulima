/* eslint-disable max-classes-per-file -- helper auth wrapper class is co-located with the storage backend */
import { Readable } from "node:stream";

import type { drive_v3 } from "@googleapis/drive";
import { drive } from "@googleapis/drive";
import { GoogleAuth, JWT, OAuth2Client } from "google-auth-library";

import { ERRORS, throwErrorCode, wrapStorageError } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { isMetaNotFound } from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions, StoredObject } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import GoogleDriveFile from "./google-drive-file";
import GoogleDriveMetaStorage from "./google-drive-meta-storage";
import type { GoogleDriveStorageOptions } from "./types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DEFAULT_CACHE_SIZE = 1024;
const KEY_PROP = "fsdkKey";
const CONTENT_TYPE_PROP = "fsdkContentType";
const FILE_FIELDS = "id, name, size, mimeType, md5Checksum, modifiedTime, appProperties";

type AuthHandle = GoogleAuth | JWT | OAuth2Client;

const basename = (key: string): string => {
    const index = key.lastIndexOf("/");

    return index === -1 ? key : key.slice(index + 1);
};

const escapeQueryValue = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("'", String.raw`\'`);

class LRU<V> {
    readonly #cap: number;

    readonly #map = new Map<string, V>();

    public constructor(cap: number) {
        this.#cap = Math.max(1, cap);
    }

    public delete(key: string): void {
        this.#map.delete(key);
    }

    public get(key: string): V | undefined {
        const v = this.#map.get(key);

        if (v === undefined) {
            return undefined;
        }

        this.#map.delete(key);
        this.#map.set(key, v);

        return v;
    }

    public set(key: string, value: V): void {
        if (this.#map.has(key)) {
            this.#map.delete(key);
        }

        this.#map.set(key, value);

        if (this.#map.size > this.#cap) {
            const oldest = this.#map.keys().next().value;

            if (oldest !== undefined) {
                this.#map.delete(oldest);
            }
        }
    }
}

const buildAuth = (options: GoogleDriveStorageOptions): AuthHandle | undefined => {
    const subject = options.subject ?? process.env.GOOGLE_DRIVE_SUBJECT;

    if (options.credentials) {
        return new JWT({
            email: options.credentials.client_email,
            key: options.credentials.private_key,
            scopes: [DRIVE_SCOPE],
            ...(subject && { subject }),
        });
    }

    if (options.keyFilename) {
        return new GoogleAuth({
            keyFile: options.keyFilename,
            scopes: [DRIVE_SCOPE],
            ...(subject && { clientOptions: { subject } }),
        });
    }

    if (options.oauth) {
        const o = new OAuth2Client({ clientId: options.oauth.clientId, clientSecret: options.oauth.clientSecret });

        o.setCredentials({ refresh_token: options.oauth.refreshToken });

        return o;
    }

    const envEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const envKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

    if (envEmail && envKey) {
        return new JWT({
            email: envEmail,
            key: envKey,
            scopes: [DRIVE_SCOPE],
            ...(subject && { subject }),
        });
    }

    const envKeyFile = process.env.GOOGLE_DRIVE_KEY_FILE;

    if (envKeyFile) {
        return new GoogleAuth({
            keyFile: envKeyFile,
            scopes: [DRIVE_SCOPE],
            ...(subject && { clientOptions: { subject } }),
        });
    }

    return undefined;
};

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const toUint8 = (data: unknown): Uint8Array => {
    if (data instanceof Uint8Array) {
        return data;
    }

    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    if (Buffer.isBuffer(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    if (ArrayBuffer.isView(data)) {
        const v = data;

        return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }

    if (typeof data === "string") {
        return new TextEncoder().encode(data);
    }

    throw new Error("Google Drive: unexpected response payload shape");
};

/* eslint-disable jsdoc/check-indentation -- bullet-list continuations are indented for readability */

/**
 * Google Drive storage backend.
 *
 * Drive is **not** a key-value store — it organizes files by `fileId`, and a
 * single virtual key (e.g. `"docs/report.pdf"`) can map to multiple Drive
 * files. The adapter routes by `appProperties.fsdkKey`, which it sets on
 * every upload and resolves via `files.list` on every read. An LRU cache
 * amortizes the resolve cost.
 *
 * **Auth precedence**:
 * 1. `client` (pre-built `drive_v3.Drive`)
 * 2. `credentials` (inline service account)
 * 3. `keyFilename` (service-account JSON path)
 * 4. `oauth` (refresh token + clientId/clientSecret)
 * 5. Env fallback: `GOOGLE_DRIVE_CLIENT_EMAIL` + `GOOGLE_DRIVE_PRIVATE_KEY`, or
 *    `GOOGLE_DRIVE_KEY_FILE` (optional: `GOOGLE_DRIVE_SUBJECT` for DWD).
 *
 * **Limitations**:
 * - `getReadUrl()` only works with `publicByDefault: true` — Drive has no
 *   signed-URL primitive.
 * - `responseContentDisposition` is not supported.
 * - `getUploadUrl()` requires explicit `credentials`/`keyFilename`/`oauth`
 *   (not a pre-built `client`) so we can mint access tokens for the
 *   resumable session.
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */
class GoogleDriveStorage extends BaseStorage<GoogleDriveFile> {
    public static override readonly name: string = "google-drive";

    public override readonly storageKind: string = "google-drive";

    /** Stores each object in a single request, so chunked/resumable uploads are rejected. */
    public override readonly supportsResumableWrites: boolean = false;

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<GoogleDriveFile>;

    private readonly authForTokens: AuthHandle | undefined;

    private readonly driveClient: drive_v3.Drive;

    private readonly fileIdCache: LRU<string>;

    private readonly publicByDefault: boolean;

    private readonly rootFolderId: string;

    private readonly sharedDriveParams: {
        corpora?: string;
        driveId?: string;
        includeItemsFromAllDrives: true;
        supportsAllDrives: true;
    };

    public constructor(config: GoogleDriveStorageOptions) {
        super(config);

        if (config.client) {
            this.driveClient = config.client;
            this.authForTokens = undefined;
        } else {
            const built = buildAuth(config);

            if (!built) {
                throw new Error(
                    "Google Drive storage: missing auth. Pass `client`, `credentials`, `keyFilename`, or `oauth`. " +
                        "Env fallbacks: GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY, or GOOGLE_DRIVE_KEY_FILE.",
                );
            }

            this.authForTokens = built;
            // `@googleapis/drive` bundles its own google-auth-library copy, so `built`
            // (typed against this package's google-auth-library) is structurally identical
            // but a distinct type identity — bridge it to the drive-side auth option type.
            this.driveClient = drive({ auth: built as unknown as drive_v3.Options["auth"], version: "v3" });
        }

        const driveId = config.driveId ?? process.env.GOOGLE_DRIVE_ID;

        this.rootFolderId = config.rootFolderId ?? process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? driveId ?? "root";
        this.publicByDefault = config.publicByDefault ?? false;
        this.fileIdCache = new LRU<string>(config.fileIdCacheSize ?? DEFAULT_CACHE_SIZE);
        this.sharedDriveParams = {
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            ...(driveId && { corpora: "drive", driveId }),
        };

        this.meta = config.metaStorage ?? new GoogleDriveMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): drive_v3.Drive {
        return this.driveClient;
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<GoogleDriveFile> {
        return this.instrumentOperation("create", async () => {
            const file = new GoogleDriveFile(config);

            file.name = this.namingFunction(file);

            await this.validate(file);

            const existing = await this.findResumable(file.id);

            if (existing !== undefined) {
                return existing;
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | GoogleDriveFile, options?: OperationOptions): Promise<GoogleDriveFile> {
        return this.instrumentOperation("write", async () => {
            let file: GoogleDriveFile;

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

                    this.assertWholeFileWrite(part, file);

                    const buffer = await collectStream(part.body);

                    this.assertWholeFileWrite(part, file, buffer.byteLength);

                    const key = file.name || file.id;

                    const appProperties: Record<string, string> = {
                        [CONTENT_TYPE_PROP]: file.contentType,
                        [KEY_PROP]: key,
                    };

                    const fields = "id, size, mimeType, md5Checksum, modifiedTime";
                    const media = (): { body: Readable; mimeType: string } => {
                        return { body: Readable.from(buffer), mimeType: file.contentType };
                    };

                    // Overwrite the file stored under the key when there is one: a second create would leave
                    // two files sharing the key, which resolveFileId then refuses to pick between. Looked up
                    // on every attempt, so a retry after a create whose response was lost updates that file.
                    const response = await this.runOperation(options, async () => {
                        const existingId = file.driveFileId ?? (await this.findFileId(key, options));

                        if (existingId) {
                            return this.driveClient.files.update({
                                ...this.sharedDriveParams,
                                fields,
                                fileId: existingId,
                                media: media(),
                                requestBody: { appProperties, mimeType: file.contentType },
                            });
                        }

                        return this.driveClient.files.create({
                            ...this.sharedDriveParams,
                            fields,
                            media: media(),
                            requestBody: {
                                appProperties,
                                mimeType: file.contentType,
                                name: basename(key),
                                parents: [this.rootFolderId],
                            },
                        });
                    });

                    const { data } = response;
                    const fileId = data.id ?? undefined;

                    if (fileId) {
                        this.fileIdCache.set(key, fileId);

                        if (this.publicByDefault) {
                            await this.runOperation(options, () =>
                                this.driveClient.permissions.create({
                                    ...this.sharedDriveParams,
                                    fileId,
                                    requestBody: { role: "reader", type: "anyone" },
                                }),
                            );
                        }
                    }

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.driveFileId = fileId;
                    file.mimeType = data.mimeType ?? file.contentType;
                    file.ETag = data.md5Checksum ?? undefined;
                }

                file.status = getFileStatus(file);

                // Completed uploads keep their metadata.
                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<GoogleDriveFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.findMeta(id);

            // write() stores the object under the upload's name.
            const key = file?.name || id;

            try {
                const fileId = file?.driveFileId ?? (await this.resolveFileId(key, options));

                await this.runOperation(options, () => this.driveClient.files.delete({ ...this.sharedDriveParams, fileId }));
                this.fileIdCache.delete(key);
            } catch (error) {
                // An upload that never received bytes has no Drive file.
                if (!isNotFoundError(error) && !isMetaNotFound(error)) {
                    throw error;
                }

                this.fileIdCache.delete(key);
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new GoogleDriveFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                id,
                name: id,
                status: "deleted" as const,
            });
        });
    }

    protected override async statObject(id: string, options?: OperationOptions): Promise<StoredObject | undefined> {
        let data: drive_v3.Schema$File;

        try {
            const fileId = await this.resolveFileId(id, options);

            ({ data } = await this.runOperation(options, () => this.driveClient.files.get({ ...this.sharedDriveParams, fields: FILE_FIELDS, fileId })));
        } catch (error) {
            if (isNotFoundError(error) || isMetaNotFound(error)) {
                return undefined;
            }

            throw error;
        }

        const props = (data.appProperties ?? {}) as Record<string, string>;

        return {
            contentType: props[CONTENT_TYPE_PROP] ?? data.mimeType ?? undefined,
            etag: data.md5Checksum ?? undefined,
            extra: { driveFileId: data.id ?? undefined, mimeType: data.mimeType ?? undefined },
            size: Number(data.size ?? 0) || 0,
        };
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            // Outside any fallback: an expired upload answers GONE instead of being served by its id.
            const stored = await this.findMeta(id);

            if (stored) {
                await this.checkIfExpired(stored);
            }

            const fileId = stored?.driveFileId ?? (await this.resolveFileId(stored?.name ?? id, options));

            const [metaResponse, mediaResponse] = await Promise.all([
                this.runOperation(options, () => this.driveClient.files.get({ ...this.sharedDriveParams, fields: FILE_FIELDS, fileId })),
                this.runOperation(options, () =>
                    this.driveClient.files.get({ ...this.sharedDriveParams, alt: "media", fileId }, { responseType: "arraybuffer" }),
                ),
            ]);

            const { data } = metaResponse;
            const bytes = toUint8(mediaResponse.data);
            const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const props = (data.appProperties ?? {}) as Record<string, string>;

            return {
                content: buffer,
                contentType: stored?.contentType ?? props[CONTENT_TYPE_PROP] ?? data.mimeType ?? "application/octet-stream",
                ETag: stored?.ETag ?? data.md5Checksum ?? undefined,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? data.modifiedTime ?? undefined,
                name: stored?.name ?? data.name ?? id,
                originalName: stored?.originalName ?? data.name ?? id,
                size: stored?.size ?? Number(data.size ?? buffer.length),
            };
        });
    }

    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<GoogleDriveFile> {
        return this.instrumentOperation("copy", async () => {
            const fromId = await this.resolveFileId(name, options);
            const previousId = await this.findFileId(destination, options);
            const response = await this.runOperation(options, () =>
                this.driveClient.files.copy({
                    ...this.sharedDriveParams,
                    fields: "id, size, mimeType, md5Checksum",
                    fileId: fromId,
                    requestBody: {
                        appProperties: { [KEY_PROP]: destination },
                        name: basename(destination),
                        parents: [this.rootFolderId],
                    },
                }),
            );

            const newId = response.data.id ?? undefined;

            if (newId) {
                this.fileIdCache.set(destination, newId);
            }

            // Replace the file already stored under the destination key, so the key keeps resolving to one file.
            if (previousId && previousId !== newId && previousId !== fromId) {
                await this.runOperation(options, () => this.driveClient.files.delete({ ...this.sharedDriveParams, fileId: previousId })).catch((error: unknown) => {
                    if (!isNotFoundError(error)) {
                        throw error;
                    }
                });
            }

            const file = new GoogleDriveFile({
                contentType: response.data.mimeType ?? "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.driveFileId = newId;
            file.mimeType = response.data.mimeType ?? undefined;
            file.ETag = response.data.md5Checksum ?? undefined;
            file.size = Number(response.data.size ?? 0);

            return file;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<GoogleDriveFile> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination, options);

            await this.delete({ id: name }, options);

            return file;
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<GoogleDriveFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const q = `'${escapeQueryValue(this.rootFolderId)}' in parents and trashed=false`;
                const files: drive_v3.Schema$File[] = [];
                let pageToken: string | undefined;

                // Drive may return fewer files than `pageSize`, so follow nextPageToken until `limit` is reached.
                do {
                    const token = pageToken;
                    const { data } = await this.runOperation(options, () =>
                        this.driveClient.files.list({
                            ...this.sharedDriveParams,
                            fields: `nextPageToken, files(${FILE_FIELDS})`,
                            // Drive rejects a pageSize above 1000.
                            pageSize: Math.min(limit - files.length, 1000),
                            q,
                            ...(token && { pageToken: token }),
                        }),
                    );

                    files.push(...(data.files ?? []));
                    pageToken = data.nextPageToken ?? undefined;
                } while (pageToken && files.length < limit);

                const out: GoogleDriveFile[] = [];

                for (const item of files) {
                    const props = (item.appProperties ?? {}) as Record<string, string>;
                    const key = props[KEY_PROP];

                    if (!key) {
                        continue;
                    }

                    if (item.id) {
                        this.fileIdCache.set(key, item.id);
                    }

                    const file = new GoogleDriveFile({
                        contentType: props[CONTENT_TYPE_PROP] ?? item.mimeType ?? "application/octet-stream",
                        metadata: {},
                        originalName: item.name ?? key,
                    });

                    file.id = key;
                    file.name = key;
                    file.driveFileId = item.id ?? undefined;
                    file.mimeType = item.mimeType ?? undefined;
                    file.size = Number(item.size ?? 0);
                    file.modifiedAt = item.modifiedTime ?? undefined;
                    file.ETag = item.md5Checksum ?? undefined;

                    out.push(file);
                }

                return out;
            },
            { limit },
        );
    }

    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        if (options?.responseContentDisposition !== undefined || options?.responseContentType !== undefined) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Google Drive: `responseContentDisposition`/`responseContentType` are not supported — Drive's webContentLink has no Content-Disposition/Content-Type override.",
            );
        }

        if (!this.publicByDefault) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Google Drive: getReadUrl() requires the adapter to be constructed with `publicByDefault: true`. " +
                    "Drive has no signed URL primitive — use get() for private files.",
            );
        }

        const fileId = await this.resolveFileId(key);

        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        if (options?.contentLength !== undefined) {
            return throwErrorCode(
                ERRORS.BAD_REQUEST,
                "Google Drive: `contentLength` is not supported for upload URLs. A Drive resumable upload session does not enforce a server-side content-length policy, so the cap would not bind; enforce size limits at your application gateway/proxy before issuing the session URL.",
            );
        }

        if (!this.authForTokens) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Google Drive: getUploadUrl() requires `credentials`, `keyFilename`, or `oauth` — not the pre-built `client` escape hatch.",
            );
        }

        const tokenResp = await (this.authForTokens as { getAccessToken: () => Promise<string | { token?: null | string }> }).getAccessToken();
        const token = typeof tokenResp === "string" ? tokenResp : tokenResp?.token;

        if (!token) {
            throw new Error("Google Drive: failed to mint access token for resumable upload session");
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
        };

        if (options?.contentType) {
            headers["X-Upload-Content-Type"] = options.contentType;
        }

        const initBody = {
            appProperties: { [KEY_PROP]: key },
            name: basename(key),
            parents: [this.rootFolderId],
        };

        const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
            body: JSON.stringify(initBody),
            headers,
            method: "POST",
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");

            throw wrapStorageError(new Error(`${response.statusText} ${text}`.trim() || response.statusText), {
                adapter: "Google Drive",
                operation: "resumable upload session",
                status: response.status,
            });
        }

        const sessionUrl = response.headers.get("location") ?? response.headers.get("Location");

        if (!sessionUrl) {
            throw wrapStorageError(new Error("response missing Location header"), {
                adapter: "Google Drive",
                code: ERRORS.STORAGE_ERROR,
                operation: "resumable upload session",
            });
        }

        return sessionUrl;
    }

    /** Like {@link resolveFileId}, but `undefined` when no file carries the key. */
    private async findFileId(key: string, options?: OperationOptions): Promise<string | undefined> {
        try {
            return await this.resolveFileId(key, options);
        } catch (error) {
            if (isMetaNotFound(error)) {
                return undefined;
            }

            throw error;
        }
    }

    private async resolveFileId(key: string, options?: OperationOptions): Promise<string> {
        const cached = this.fileIdCache.get(key);

        if (cached) {
            return cached;
        }

        // Scope the lookup to the configured root folder. Without the `in parents` clause this
        // query searches every file the credentials can see (My Drive + shared drives + anything
        // shared with the service account), so a foreign file carrying a matching appProperties key
        // would resolve and escape the adapter's root. All adapter-created files are written into
        // `rootFolderId` (see write/copy/getUploadUrl), so the filter never excludes our own files.
        const q = `appProperties has { key='${KEY_PROP}' and value='${escapeQueryValue(key)}' } and '${escapeQueryValue(this.rootFolderId)}' in parents and trashed=false`;
        const response = await this.runOperation(options, () =>
            this.driveClient.files.list({
                ...this.sharedDriveParams,
                fields: "files(id)",
                pageSize: 2,
                q,
            }),
        );

        const files = response.data.files ?? [];

        if (files.length === 0) {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND, `Google Drive: not found: ${key}`);
        }

        if (files.length > 1) {
            throw new Error(`Google Drive: multiple files share virtual key '${key}'. Resolve via storage.raw.`);
        }

        const id = files[0]?.id;

        if (!id) {
            throw new Error(`Google Drive: list returned no fileId for ${key}`);
        }

        this.fileIdCache.set(key, id);

        return id;
    }
}

const isNotFoundError = (error: unknown): boolean => {
    if (error === null || typeof error !== "object") {
        return false;
    }

    const typedError = error as { code?: number | string; response?: { status?: number }; status?: number };

    if (typeof typedError.code === "number" && typedError.code === 404) {
        return true;
    }

    if (typeof typedError.status === "number" && typedError.status === 404) {
        return true;
    }

    return typeof typedError.response?.status === "number" && typedError.response.status === 404;
};

export default GoogleDriveStorage;
