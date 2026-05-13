import { Readable } from "node:stream";

import type { BoxClient } from "box-typescript-sdk-gen";
import { BoxCcgAuth, BoxClient as BoxClientImpl, BoxDeveloperTokenAuth, BoxJwtAuth, BoxOAuth, CcgConfig, JwtConfig, OAuthConfig } from "box-typescript-sdk-gen";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import BoxFile from "./box-file";
import BoxMetaStorage from "./box-meta-storage";
import type { BoxJwtOptions, BoxStorageOptions } from "./types";

const DEFAULT_ROOT_FOLDER_ID = "0";
const SIMPLE_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

interface AuthHandle {
    ensureReady: () => Promise<void>;
}

const noopAuthHandle: AuthHandle = {
    ensureReady: () => Promise.resolve(),
};

interface ResolvedAuth {
    authHandle: AuthHandle;
    client: BoxClient;
}

interface BoxFileLike {
    contentModifiedAt?: string | null;
    etag?: string | null;
    id?: string;
    modifiedAt?: string;
    name?: string;
    sharedLink?: { downloadUrl?: string | null; url?: string } | undefined;
    size?: number;
}

const trimSlashes = (s: string): string => {
    let start = 0;
    let end = s.length;

    while (start < end && s[start] === "/") {
        start += 1;
    }

    while (end > start && s[end - 1] === "/") {
        end -= 1;
    }

    return start === 0 && end === s.length ? s : s.slice(start, end);
};

interface SplitKey {
    leaf: string;
    parents: string[];
}

const splitKey = (key: string): SplitKey => {
    const trimmed = trimSlashes(key);

    if (!trimmed) {
        throw new Error("Box: key must not be empty");
    }

    const parts = trimmed.split("/").filter((p) => p.length > 0);
    const leaf = parts.pop() ?? "";

    if (!leaf) {
        throw new Error(`Box: key "${key}" has no file name segment`);
    }

    return { leaf, parents: parts };
};

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const bufferToReadable = (buffer: Buffer): Readable => Readable.from(buffer);

const buildJwtConfig = (jwt: BoxJwtOptions): JwtConfig => {
    if ("configJsonString" in jwt) {
        return JwtConfig.fromConfigJsonString(jwt.configJsonString);
    }

    return JwtConfig.fromConfigFile(jwt.configFilePath);
};

const countAuthMethods = (options: BoxStorageOptions): number =>
    [options.developerToken, options.oauth, options.ccg, options.jwt].filter((v) => v !== undefined).length;

const resolveAuth = (options: BoxStorageOptions): ResolvedAuth => {
    if (options.client) {
        return { authHandle: noopAuthHandle, client: options.client };
    }

    if (countAuthMethods(options) > 1) {
        throw new Error("Box storage: pass exactly one of `developerToken`, `oauth`, `ccg`, or `jwt`.");
    }

    if (options.developerToken !== undefined) {
        const auth = new BoxDeveloperTokenAuth({ token: options.developerToken });

        return { authHandle: noopAuthHandle, client: new BoxClientImpl({ auth }) };
    }

    if (options.oauth) {
        const { clientId, clientSecret, refreshToken } = options.oauth;
        const config = new OAuthConfig({ clientId, clientSecret });
        const auth = new BoxOAuth({ config });

        let seeded: Promise<void> | undefined;
        const seed = async (): Promise<void> => {
            await auth.tokenStorage.store({ accessToken: "", refreshToken });
        };
        const handle: AuthHandle = {
            ensureReady: () => {
                if (!seeded) {
                    seeded = seed();
                }

                return seeded;
            },
        };

        return { authHandle: handle, client: new BoxClientImpl({ auth }) };
    }

    if (options.ccg) {
        const { clientId, clientSecret, enterpriseId, userId } = options.ccg;

        if (!enterpriseId && !userId) {
            throw new Error("Box storage: `ccg` auth requires either `enterpriseId` or `userId`.");
        }

        const config = new CcgConfig({
            clientId,
            clientSecret,
            ...(enterpriseId !== undefined && { enterpriseId }),
            ...(userId !== undefined && { userId }),
        });
        const auth = new BoxCcgAuth({ config });

        return { authHandle: noopAuthHandle, client: new BoxClientImpl({ auth }) };
    }

    if (options.jwt) {
        const config = buildJwtConfig(options.jwt);
        const auth = new BoxJwtAuth({ config });

        return { authHandle: noopAuthHandle, client: new BoxClientImpl({ auth }) };
    }

    const envDeveloperToken = process.env.BOX_DEVELOPER_TOKEN;

    if (envDeveloperToken) {
        const auth = new BoxDeveloperTokenAuth({ token: envDeveloperToken });

        return { authHandle: noopAuthHandle, client: new BoxClientImpl({ auth }) };
    }

    throw new Error("Box storage: missing auth. Pass `client`, `developerToken`, `oauth`, `ccg`, or `jwt`. Env fallback: BOX_DEVELOPER_TOKEN.");
};

const isNotFoundError = (error: unknown): boolean => {
    if (error && typeof error === "object") {
        const object = error as { responseInfo?: { body?: { code?: string }; code?: string; statusCode?: number } };
        const code = object.responseInfo?.code ?? object.responseInfo?.body?.code;
        const status = object.responseInfo?.statusCode;

        return status === 404 || code === "not_found" || code === "file_not_found" || code === "folder_not_found" || code === "trashed";
    }

    return false;
};

const isConflictError = (error: unknown): boolean => {
    if (error && typeof error === "object") {
        const object = error as { responseInfo?: { body?: { code?: string }; code?: string; statusCode?: number } };
        const code = object.responseInfo?.code ?? object.responseInfo?.body?.code;
        const status = object.responseInfo?.statusCode;

        return status === 409 || code === "item_name_in_use" || code === "conflict";
    }

    return false;
};

/* eslint-disable jsdoc/check-indentation -- bullet-list continuations are indented for readability */

/**
 * Box storage backend.
 *
 * Routes virtual keys onto Box folder/file IDs under `rootFolderId`. Uploads
 * use `uploads.uploadFile` / `uploads.uploadFileVersion` up to 50 MB and
 * switch to the chunked-upload session API above that threshold. Subfolders
 * along a key's path are auto-created on first write.
 *
 * **Auth precedence**:
 * 1. `client` (pre-built `BoxClient`)
 * 2. `developerToken` (static, from Box developer console)
 * 3. `oauth` (refresh-token seeded — `clientId` + `clientSecret` + `refreshToken`)
 * 4. `ccg` (Client Credentials Grant — `clientId` + `clientSecret` + `enterpriseId` or `userId`)
 * 5. `jwt` (JWT Server Auth — `configJsonString` or `configFilePath`)
 * 6. Env fallback: `BOX_DEVELOPER_TOKEN`
 *
 * **Limitations**:
 * - `metadata` is not supported on the unified API — Box exposes file metadata
 *   via classifications and metadata templates. Use `storage.raw.fileMetadata.*`
 *   directly if you need them.
 * - `cacheControl` is not supported (Box does not expose HTTP cache headers
 *   on file content).
 * - `getUploadUrl` is not supported — Box uploads require a multipart `POST`
 *   with both an `attributes` JSON part and the file bytes part, which doesn't
 *   fit the PUT-with-raw-body presigned-URL contract.
 * - `responseContentDisposition` is not supported on signed download URLs.
 * - `write()` buffers the full part body in memory before choosing between
 *   the simple-upload and chunked-upload paths. Each request handler runs
 *   independently, so concurrent multi-GB writes are bounded by the host's
 *   available memory.
 */
class BoxStorage extends BaseStorage<BoxFile> {
    public static override readonly name: string = "box";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<BoxFile>;

    private readonly authHandle: AuthHandle;

    private readonly client: BoxClient;

    private readonly fileIdCache: Map<string, string>;

    private readonly folderIdCache: Map<string, string>;

    private readonly publicByDefault: boolean;

    private readonly rootFolderId: string;

    public constructor(config: BoxStorageOptions) {
        super(config);

        this.rootFolderId = config.rootFolderId ?? DEFAULT_ROOT_FOLDER_ID;
        this.publicByDefault = config.publicByDefault ?? false;

        const resolved = resolveAuth(config);

        this.client = resolved.client;
        this.authHandle = resolved.authHandle;

        this.folderIdCache = new Map();
        this.fileIdCache = new Map();

        this.meta = config.metaStorage ?? new BoxMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): BoxClient {
        return this.client;
    }

    public async create(config: FileInit): Promise<BoxFile> {
        return this.instrumentOperation("create", async () => {
            const file = new BoxFile(config);

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

    public async write(part: FilePart | FileQuery | BoxFile): Promise<BoxFile> {
        return this.instrumentOperation("write", async () => {
            let file: BoxFile;

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

                    await this.authHandle.ensureReady();

                    const buffer = await collectStream(part.body);
                    const key = file.name || file.id;
                    const { leaf, parents } = splitKey(key);
                    const folderId = await this.resolveFolderId(parents, { create: true });
                    const existingFileId = await this.resolveExistingFileForUpload(key, folderId, leaf);
                    const item = await this.performUpload(existingFileId, folderId, leaf, buffer);

                    if (item.id) {
                        this.fileIdCache.set(key, item.id);

                        if (this.publicByDefault) {
                            await this.ensureSharedLink(item.id);
                        }
                    }

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.boxFileId = item.id;
                    file.eTag = item.etag ?? undefined;
                    file.ETag = item.etag ?? undefined;
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

    public async delete({ id }: FileQuery): Promise<BoxFile> {
        return this.instrumentOperation("delete", async () => {
            let file: BoxFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata
            }

            const key = file?.name ?? id;

            await this.authHandle.ensureReady();

            try {
                const fileId = file?.boxFileId ?? (await this.resolveFileId(key));

                await this.client.files.deleteFileById(fileId);
                this.fileIdCache.delete(key);
            } catch (error) {
                if (!isNotFoundError(error)) {
                    throw error;
                }
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new BoxFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                id,
                name: id,
                status: "deleted" as const,
            });
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: BoxFile | undefined;
            let key = id;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.name ?? id;
            } catch {
                // direct lookup
            }

            await this.authHandle.ensureReady();

            const fileId = stored?.boxFileId ?? (await this.resolveFileId(key));
            const item = (await this.client.files.getFileById(fileId)) as BoxFileLike;
            const url = await this.client.downloads.getDownloadFileUrl(fileId);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Box: download fetch failed (${response.status})`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            return {
                content: buffer,
                contentType: stored?.contentType ?? "application/octet-stream",
                ETag: stored?.ETag ?? item.etag ?? undefined,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? item.modifiedAt ?? item.contentModifiedAt ?? undefined,
                name: stored?.name ?? item.name ?? key,
                originalName: stored?.originalName ?? item.name ?? key,
                size: stored?.size ?? item.size ?? buffer.length,
            };
        });
    }

    public async copy(name: string, destination: string): Promise<BoxFile> {
        return this.instrumentOperation("copy", async () => {
            await this.authHandle.ensureReady();

            const sourceId = await this.resolveFileId(name);
            const { leaf, parents } = splitKey(destination);
            const destinationFolderId = await this.resolveFolderId(parents, { create: true });
            const created = (await this.client.files.copyFile(sourceId, {
                name: leaf,
                parent: { id: destinationFolderId },
            })) as BoxFileLike;

            if (created.id) {
                this.fileIdCache.set(destination, created.id);
            }

            const file = new BoxFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.boxFileId = created.id;
            file.eTag = created.etag ?? undefined;
            file.ETag = created.etag ?? undefined;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<BoxFile> {
        return this.instrumentOperation("move", async () => {
            await this.authHandle.ensureReady();

            const sourceId = await this.resolveFileId(name);
            const { leaf, parents } = splitKey(destination);
            const destinationFolderId = await this.resolveFolderId(parents, { create: true });
            const updated = (await this.client.files.updateFileById(sourceId, {
                requestBody: {
                    name: leaf,
                    parent: { id: destinationFolderId },
                },
            })) as BoxFileLike;

            this.fileIdCache.delete(name);

            if (updated.id) {
                this.fileIdCache.set(destination, updated.id);
            }

            const file = new BoxFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.boxFileId = updated.id;
            file.eTag = updated.etag ?? undefined;
            file.ETag = updated.etag ?? undefined;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000): Promise<BoxFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                await this.authHandle.ensureReady();

                const out: BoxFile[] = [];
                let offset = 0;
                const pageLimit = Math.min(limit, 1000);

                while (out.length < limit) {
                    const page = await this.client.folders.getFolderItems(this.rootFolderId, {
                        queryParams: {
                            fields: ["id", "name", "size", "modified_at", "etag", "type"],
                            limit: pageLimit,
                            offset,
                        },
                    });
                    const entries = page.entries ?? [];

                    for (const entry of entries) {
                        const item = entry as BoxFileLike & { type?: string };

                        if (item.type !== "file" || !item.id || !item.name) {
                            continue;
                        }

                        this.fileIdCache.set(item.name, item.id);

                        const file = new BoxFile({
                            contentType: "application/octet-stream",
                            metadata: {},
                            originalName: item.name,
                        });

                        file.id = item.name;
                        file.name = item.name;
                        file.boxFileId = item.id;
                        file.eTag = item.etag ?? undefined;
                        file.ETag = item.etag ?? undefined;
                        file.size = item.size ?? 0;
                        file.modifiedAt = item.modifiedAt ?? item.contentModifiedAt ?? undefined;

                        out.push(file);

                        if (out.length >= limit) {
                            break;
                        }
                    }

                    if (entries.length < pageLimit) {
                        break;
                    }

                    offset += entries.length;
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
        if (options?.responseContentDisposition || options?.responseContentType) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "Box: `responseContentDisposition` / `responseContentType` are not supported — Box download URLs and shared-link URLs have no overrides.",
            );
        }

        await this.authHandle.ensureReady();

        const fileId = await this.resolveFileId(key);

        if (this.publicByDefault) {
            return this.ensureSharedLink(fileId);
        }

        return this.client.downloads.getDownloadFileUrl(fileId);
    }

    // eslint-disable-next-line class-methods-use-this -- override of the base contract; signals "not supported" without instance state
    public override async getUploadUrl(_key: string, _options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "Box: `getUploadUrl` is not supported. Box uploads require a multipart POST with an `attributes` JSON part and a file bytes part; this doesn't fit the PUT-style upload-url contract. Use `write()` server-side, or the Box UI Elements / Box Content Uploader for browser flows.",
        );
    }

    private async findChildByName(folderId: string, name: string): Promise<{ id: string; type: "file" | "folder" | "web_link" } | undefined> {
        let offset = 0;
        const limit = 1000;

        while (true) {
            const page = await this.client.folders.getFolderItems(folderId, {
                queryParams: { fields: ["id", "name", "type"], limit, offset },
            });
            const entries = page.entries ?? [];

            for (const entry of entries) {
                const item = entry as { id?: string; name?: string; type?: string };

                if (item.name === name && item.id && item.type) {
                    return { id: item.id, type: item.type as "file" | "folder" | "web_link" };
                }
            }

            if (entries.length < limit) {
                return undefined;
            }

            offset += entries.length;
        }
    }

    // eslint-disable-next-line class-methods-use-this -- keep instance shape; could be static but callers use `this.folderCacheKey`
    private folderCacheKey(parents: ReadonlyArray<string>): string {
        return parents.join("/");
    }

    private async resolveFolderId(parents: ReadonlyArray<string>, options: { create: boolean }): Promise<string> {
        if (parents.length === 0) {
            return this.rootFolderId;
        }

        const cacheKey = this.folderCacheKey(parents);
        const cached = this.folderIdCache.get(cacheKey);

        if (cached) {
            return cached;
        }

        let currentId = this.rootFolderId;
        const walked: string[] = [];

        for (const segment of parents) {
            walked.push(segment);

            const partialKey = this.folderCacheKey(walked);
            const partialCached = this.folderIdCache.get(partialKey);

            if (partialCached) {
                currentId = partialCached;
                continue;
            }

            const child = await this.findChildByName(currentId, segment);

            if (child && child.type === "folder") {
                currentId = child.id;
                this.folderIdCache.set(partialKey, currentId);
                continue;
            }

            if (child && child.type !== "folder") {
                throw new Error(`Box: path segment "${segment}" exists but is not a folder`);
            }

            if (!options.create) {
                throw new Error(`Box: folder "${walked.join("/")}" not found`);
            }

            try {
                const created = await this.client.folders.createFolder({ name: segment, parent: { id: currentId } });

                if (!created.id) {
                    throw new Error(`Box: createFolder did not return an id for "${segment}"`);
                }

                currentId = created.id;
                this.folderIdCache.set(partialKey, currentId);
            } catch (error) {
                if (isConflictError(error)) {
                    const existing = await this.findChildByName(currentId, segment);

                    if (existing && existing.type === "folder") {
                        currentId = existing.id;
                        this.folderIdCache.set(partialKey, currentId);
                        continue;
                    }
                }

                throw error;
            }
        }

        this.folderIdCache.set(cacheKey, currentId);

        return currentId;
    }

    private async resolveFileId(key: string): Promise<string> {
        const cached = this.fileIdCache.get(key);

        if (cached) {
            return cached;
        }

        const { leaf, parents } = splitKey(key);
        const folderId = await this.resolveFolderId(parents, { create: false });
        const child = await this.findChildByName(folderId, leaf);

        if (!child || child.type !== "file") {
            throw new Error(`Box: file "${key}" not found`);
        }

        this.fileIdCache.set(key, child.id);

        return child.id;
    }

    private async resolveExistingFileForUpload(key: string, folderId: string, leaf: string): Promise<string | undefined> {
        const cached = this.fileIdCache.get(key);

        if (cached) {
            return cached;
        }

        const existing = await this.findChildByName(folderId, leaf);

        if (!existing) {
            return undefined;
        }

        if (existing.type === "file") {
            this.fileIdCache.set(key, existing.id);

            return existing.id;
        }

        throw new Error(`Box: "${key}" already exists as a non-file (${existing.type})`);
    }

    private async performUpload(fileId: string | undefined, folderId: string, leaf: string, data: Buffer): Promise<BoxFileLike> {
        if (data.byteLength > SIMPLE_UPLOAD_LIMIT_BYTES) {
            return (await this.client.chunkedUploads.uploadBigFile(bufferToReadable(data), leaf, data.byteLength, folderId)) as BoxFileLike;
        }

        if (fileId) {
            const response = await this.client.uploads.uploadFileVersion(fileId, {
                attributes: { name: leaf },
                file: bufferToReadable(data),
            });
            const entry = (response.entries ?? [])[0] as BoxFileLike | undefined;

            if (!entry) {
                throw new Error("Box: uploadFileVersion returned no file");
            }

            return entry;
        }

        const response = await this.client.uploads.uploadFile({
            attributes: { name: leaf, parent: { id: folderId } },
            file: bufferToReadable(data),
        });
        const entry = (response.entries ?? [])[0] as BoxFileLike | undefined;

        if (!entry) {
            throw new Error("Box: uploadFile returned no file");
        }

        return entry;
    }

    private async ensureSharedLink(fileId: string): Promise<string> {
        try {
            const file = (await this.client.sharedLinksFiles.addShareLinkToFile(
                fileId,
                { sharedLink: { access: "open" } },
                { fields: "shared_link" },
            )) as BoxFileLike;
            const link = file.sharedLink;
            const out = link?.downloadUrl ?? link?.url;

            if (!out) {
                return this.fetchSharedLinkUrl(fileId);
            }

            return out;
        } catch (error) {
            if (isConflictError(error)) {
                return this.fetchSharedLinkUrl(fileId);
            }

            throw error;
        }
    }

    private async fetchSharedLinkUrl(fileId: string): Promise<string> {
        const file = (await this.client.sharedLinksFiles.getSharedLinkForFile(fileId, { fields: "shared_link" })) as BoxFileLike;
        const link = file.sharedLink;
        const out = link?.downloadUrl ?? link?.url;

        if (!out) {
            throw new Error("Box: file has no shared link. Call write() with publicByDefault: true, or addShareLinkToFile via storage.raw.");
        }

        return out;
    }

    private internalOnComplete = (file: BoxFile): Promise<void> => this.deleteMeta(file.id);
}

export default BoxStorage;
