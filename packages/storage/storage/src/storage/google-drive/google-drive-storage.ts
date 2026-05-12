import { Readable } from "node:stream";

import { drive, type drive_v3 } from "@googleapis/drive";
import { GoogleAuth, JWT, OAuth2Client } from "google-auth-library";

import { ERRORS, throwErrorCode, wrapStorageError } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
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
    const idx = key.lastIndexOf("/");

    return idx === -1 ? key : key.slice(idx + 1);
};

const escapeQueryValue = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

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

const buildAuth = (opts: GoogleDriveStorageOptions): AuthHandle | undefined => {
    const subject = opts.subject ?? process.env.GOOGLE_DRIVE_SUBJECT;

    if (opts.credentials) {
        return new JWT({
            email: opts.credentials.client_email,
            key: opts.credentials.private_key,
            scopes: [DRIVE_SCOPE],
            ...(subject && { subject }),
        });
    }

    if (opts.keyFilename) {
        return new GoogleAuth({
            keyFile: opts.keyFilename,
            scopes: [DRIVE_SCOPE],
            ...(subject && { clientOptions: { subject } }),
        });
    }

    if (opts.oauth) {
        const o = new OAuth2Client({ clientId: opts.oauth.clientId, clientSecret: opts.oauth.clientSecret });

        o.setCredentials({ refresh_token: opts.oauth.refreshToken });

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
        const v = data as ArrayBufferView;

        return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }

    if (typeof data === "string") {
        return new TextEncoder().encode(data);
    }

    throw new Error("Google Drive: unexpected response payload shape");
};

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
 */
class GoogleDriveStorage extends BaseStorage<GoogleDriveFile> {
    public static override readonly name: string = "google-drive";

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
                    "Google Drive storage: missing auth. Pass `client`, `credentials`, `keyFilename`, or `oauth`. "
                        + "Env fallbacks: GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY, or GOOGLE_DRIVE_KEY_FILE.",
                );
            }

            this.authForTokens = built;
            this.driveClient = drive({ auth: built as never, version: "v3" });
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

    public async create(config: FileInit): Promise<GoogleDriveFile> {
        return this.instrumentOperation("create", async () => {
            const file = new GoogleDriveFile(config);

            file.name = this.namingFunction(file);

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

    public async write(part: FilePart | FileQuery | GoogleDriveFile): Promise<GoogleDriveFile> {
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

                    const buffer = await collectStream(part.body);
                    const key = file.name || file.id;

                    const appProperties: Record<string, string> = {
                        [CONTENT_TYPE_PROP]: file.contentType,
                        [KEY_PROP]: key,
                    };

                    const res = await this.driveClient.files.create({
                        ...this.sharedDriveParams,
                        fields: "id, size, mimeType, md5Checksum, modifiedTime",
                        media: {
                            body: Readable.from(buffer),
                            mimeType: file.contentType,
                        },
                        requestBody: {
                            appProperties,
                            mimeType: file.contentType,
                            name: basename(key),
                            parents: [this.rootFolderId],
                        },
                    });

                    const { data } = res;
                    const fileId = data.id ?? undefined;

                    if (fileId) {
                        this.fileIdCache.set(key, fileId);

                        if (this.publicByDefault) {
                            await this.driveClient.permissions.create({
                                ...this.sharedDriveParams,
                                fileId,
                                requestBody: { role: "reader", type: "anyone" },
                            });
                        }
                    }

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.driveFileId = fileId;
                    file.mimeType = data.mimeType ?? file.contentType;
                    file.ETag = data.md5Checksum ?? undefined;
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

    public async delete({ id }: FileQuery): Promise<GoogleDriveFile> {
        return this.instrumentOperation("delete", async () => {
            let file: GoogleDriveFile | undefined;
            const key = id;

            try {
                file = await this.getMeta(id);
            } catch {
                // direct id lookup
            }

            try {
                const fileId = file?.driveFileId ?? (await this.resolveFileId(key));

                await this.driveClient.files.delete({ ...this.sharedDriveParams, fileId });
                this.fileIdCache.delete(key);
            } catch (error) {
                if (!isNotFoundError(error)) {
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

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: GoogleDriveFile | undefined;
            let fileId: string;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                fileId = stored.driveFileId ?? (await this.resolveFileId(stored.name ?? id));
            } catch {
                fileId = await this.resolveFileId(id);
            }

            const [metaRes, mediaRes] = await Promise.all([
                this.driveClient.files.get({ ...this.sharedDriveParams, fields: FILE_FIELDS, fileId }),
                this.driveClient.files.get({ ...this.sharedDriveParams, alt: "media", fileId }, { responseType: "arraybuffer" }),
            ]);

            const data = metaRes.data;
            const bytes = toUint8(mediaRes.data as unknown);
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

    public async copy(name: string, destination: string): Promise<GoogleDriveFile> {
        return this.instrumentOperation("copy", async () => {
            const fromId = await this.resolveFileId(name);
            const res = await this.driveClient.files.copy({
                ...this.sharedDriveParams,
                fields: "id, size, mimeType, md5Checksum",
                fileId: fromId,
                requestBody: {
                    appProperties: { [KEY_PROP]: destination },
                    name: basename(destination),
                    parents: [this.rootFolderId],
                },
            });

            const newId = res.data.id ?? undefined;

            if (newId) {
                this.fileIdCache.set(destination, newId);
            }

            const file = new GoogleDriveFile({
                contentType: res.data.mimeType ?? "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.driveFileId = newId;
            file.mimeType = res.data.mimeType ?? undefined;
            file.ETag = res.data.md5Checksum ?? undefined;
            file.size = Number(res.data.size ?? 0);

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<GoogleDriveFile> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination);

            await this.delete({ id: name });

            return file;
        });
    }

    public override async list(limit = 1000): Promise<GoogleDriveFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const q = `'${escapeQueryValue(this.rootFolderId)}' in parents and trashed=false`;
                const res = await this.driveClient.files.list({
                    ...this.sharedDriveParams,
                    fields: `nextPageToken, files(${FILE_FIELDS})`,
                    pageSize: limit,
                    q,
                });

                const files = res.data.files ?? [];
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
        if (options?.responseContentDisposition) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Google Drive: `responseContentDisposition` is not supported — Drive's webContentLink has no Content-Disposition override.",
            );
        }

        if (!this.publicByDefault) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Google Drive: getReadUrl() requires the adapter to be constructed with `publicByDefault: true`. "
                    + "Drive has no signed URL primitive — use get() for private files.",
            );
        }

        const fileId = await this.resolveFileId(key);

        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
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

        if (options?.contentLength !== undefined) {
            headers["X-Upload-Content-Length"] = String(options.contentLength);
        }

        const initBody = {
            appProperties: { [KEY_PROP]: key },
            name: basename(key),
            parents: [this.rootFolderId],
        };

        const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
            body: JSON.stringify(initBody),
            headers,
            method: "POST",
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");

            throw wrapStorageError(new Error(`${res.statusText} ${text}`.trim() || res.statusText), {
                adapter: "Google Drive",
                operation: "resumable upload session",
                status: res.status,
            });
        }

        const sessionUrl = res.headers.get("location") ?? res.headers.get("Location");

        if (!sessionUrl) {
            throw wrapStorageError(new Error("response missing Location header"), {
                adapter: "Google Drive",
                code: ERRORS.STORAGE_ERROR,
                operation: "resumable upload session",
            });
        }

        return sessionUrl;
    }

    private async resolveFileId(key: string): Promise<string> {
        const cached = this.fileIdCache.get(key);

        if (cached) {
            return cached;
        }

        const q = `appProperties has { key='${KEY_PROP}' and value='${escapeQueryValue(key)}' } and trashed=false`;
        const res = await this.driveClient.files.list({
            ...this.sharedDriveParams,
            fields: "files(id)",
            pageSize: 2,
            q,
        });

        const files = res.data.files ?? [];

        if (files.length === 0) {
            throw new Error(`Google Drive: not found: ${key}`);
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

    private internalOnComplete = (file: GoogleDriveFile): Promise<void> => this.deleteMeta(file.id);
}

const isNotFoundError = (error: unknown): boolean => {
    if (error === null || typeof error !== "object") {
        return false;
    }

    const e = error as { code?: number | string; response?: { status?: number }; status?: number };

    if (typeof e.code === "number" && e.code === 404) {
        return true;
    }

    if (typeof e.status === "number" && e.status === 404) {
        return true;
    }

    return typeof e.response?.status === "number" && e.response.status === 404;
};

export default GoogleDriveStorage;
