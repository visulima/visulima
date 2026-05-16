import type { files } from "dropbox";
import { Dropbox, DropboxAuth, DropboxResponseError } from "dropbox";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import { createOAuthRefreshHandle } from "../../utils/oauth-refresh";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import DropboxFile from "./dropbox-file";
import DropboxMetaStorage from "./dropbox-meta-storage";
import type { DropboxStorageOptions } from "./types";

const MAX_TEMPORARY_LINK_DURATION = 14_400;
const SIMPLE_UPLOAD_LIMIT_BYTES = 150 * 1024 * 1024;
const UPLOAD_SESSION_CHUNK_BYTES = 8 * 1024 * 1024;

type DropboxWithAuth = Dropbox & {
    auth: {
        getAccessToken: () => string;
        setAccessToken: (token: string) => void;
    };
};

interface AuthHandle {
    ensureAccessToken: () => Promise<void>;
    getAccessToken: () => Promise<string>;
}

const setAccessToken = (client: Dropbox, token: string): void => {
    (client as DropboxWithAuth).auth.setAccessToken(token);
};

const getAccessToken = (client: Dropbox): string => (client as DropboxWithAuth).auth.getAccessToken();

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

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const rewriteSharedLinkForDirectDownload = (url: string): string => {
    if (url.includes("?dl=0")) {
        return url.replace("?dl=0", "?dl=1");
    }

    if (url.includes("?dl=")) {
        return url;
    }

    return url + (url.includes("?") ? "&dl=1" : "?dl=1");
};

const createStaticAccessTokenAuth = (client: Dropbox, token: string): AuthHandle => {
    setAccessToken(client, token);

    return {
        ensureAccessToken: () => Promise.resolve(),
        getAccessToken: () => Promise.resolve(token),
    };
};

const createCallableAccessTokenAuth = (client: Dropbox, source: () => string | Promise<string>): AuthHandle => {
    const ensure = async (): Promise<string> => {
        const token = await source();

        setAccessToken(client, token);

        return token;
    };

    return {
        async ensureAccessToken() {
            await ensure();
        },
        getAccessToken: ensure,
    };
};

interface RefreshTokenAuthOptions {
    appKey: string;
    appSecret?: string;
    refreshToken: string;
}

const createRefreshTokenAuth = (client: Dropbox, options: RefreshTokenAuthOptions): AuthHandle => {
    const handle = createOAuthRefreshHandle({
        buildBody: () =>
            new URLSearchParams({
                client_id: options.appKey,
                grant_type: "refresh_token",
                refresh_token: options.refreshToken,
                ...(options.appSecret && { client_secret: options.appSecret }),
            }),
        onRefresh: (token) => {
            setAccessToken(client, token);
        },
        provider: "Dropbox",
        tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    });

    return {
        async ensureAccessToken() {
            await handle.getAccessToken();
        },
        getAccessToken: () => handle.getAccessToken(),
    };
};

interface ResolvedAuth {
    authHandle: AuthHandle;
    client: Dropbox;
}

const resolveAuth = (options: DropboxStorageOptions): ResolvedAuth => {
    if (options.client) {
        const builtClient = options.client;

        return {
            authHandle: {
                ensureAccessToken: () => Promise.resolve(),
                getAccessToken: () => Promise.resolve(getAccessToken(builtClient)),
            },
            client: builtClient,
        };
    }

    const explicitToken = options.accessToken;
    const explicitRefresh = options.refreshToken !== undefined || options.appKey !== undefined || options.appSecret !== undefined;

    if (explicitToken !== undefined && explicitRefresh) {
        throw new Error("Dropbox storage: pass exactly one of `accessToken` or `refreshToken` (with `appKey`).");
    }

    if (explicitToken !== undefined) {
        const auth = new DropboxAuth({ accessToken: typeof explicitToken === "string" ? explicitToken : undefined });
        const client = new Dropbox({ auth });
        const handle =
            typeof explicitToken === "function" ? createCallableAccessTokenAuth(client, explicitToken) : createStaticAccessTokenAuth(client, explicitToken);

        return { authHandle: handle, client };
    }

    if (explicitRefresh) {
        if (!options.refreshToken || !options.appKey) {
            throw new Error("Dropbox storage: refresh-token auth requires both `refreshToken` and `appKey`.");
        }

        const auth = new DropboxAuth({});
        const client = new Dropbox({ auth });
        const handle = createRefreshTokenAuth(client, {
            appKey: options.appKey,
            ...(options.appSecret && { appSecret: options.appSecret }),
            refreshToken: options.refreshToken,
        });

        return { authHandle: handle, client };
    }

    const envAccessToken = process.env.DROPBOX_ACCESS_TOKEN;

    if (envAccessToken) {
        const auth = new DropboxAuth({ accessToken: envAccessToken });
        const client = new Dropbox({ auth });

        return { authHandle: createStaticAccessTokenAuth(client, envAccessToken), client };
    }

    const envRefreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const envAppKey = process.env.DROPBOX_APP_KEY;

    if (envRefreshToken && envAppKey) {
        const envAppSecret = process.env.DROPBOX_APP_SECRET;
        const auth = new DropboxAuth({});
        const client = new Dropbox({ auth });

        return {
            authHandle: createRefreshTokenAuth(client, {
                appKey: envAppKey,
                ...(envAppSecret && { appSecret: envAppSecret }),
                refreshToken: envRefreshToken,
            }),
            client,
        };
    }

    throw new Error(
        "Dropbox storage: missing auth. Pass `client`, `accessToken`, or `refreshToken` + `appKey`. " +
            "Env fallbacks: DROPBOX_ACCESS_TOKEN, or DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY (+ DROPBOX_APP_SECRET).",
    );
};

/* eslint-disable jsdoc/check-indentation -- bullet-list continuations are indented for readability */

/**
 * Dropbox storage backend.
 *
 * Routes virtual keys onto Dropbox paths under `rootFolderPath`. Uploads use
 * the simple `filesUpload` endpoint up to 150 MB and switch to chunked
 * upload sessions above that threshold.
 *
 * **Auth precedence**:
 * 1. `client` (pre-built `Dropbox`)
 * 2. `accessToken` (string or `() => string | Promise&lt;string>`)
 * 3. `refreshToken` + `appKey` (+ optional `appSecret`)
 * 4. Env fallback: `DROPBOX_ACCESS_TOKEN`, or `DROPBOX_REFRESH_TOKEN` +
 *    `DROPBOX_APP_KEY` (+ optional `DROPBOX_APP_SECRET`)
 *
 * **Limitations**:
 * - `metadata` and `cacheControl` are not supported (Dropbox files have no
 *   native arbitrary-metadata field, and no HTTP cache-header overrides).
 * - `getUploadUrl` is not supported — Dropbox's `files/get_temporary_upload_link`
 *   requires a `POST` with raw body, which doesn't fit a presigned-PUT contract.
 * - `responseContentDisposition` is not supported on signed URLs.
 */
class DropboxStorage extends BaseStorage<DropboxFile> {
    public static override readonly name: string = "dropbox";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<DropboxFile>;

    private readonly authHandle: AuthHandle;

    private readonly client: Dropbox;

    private readonly defaultUrlExpiresIn: number;

    private readonly publicByDefault: boolean;

    private readonly rootFolderPath: string;

    public constructor(config: DropboxStorageOptions) {
        super(config);

        this.rootFolderPath = trimSlashes(config.rootFolderPath ?? "");
        this.publicByDefault = config.publicByDefault ?? false;
        this.defaultUrlExpiresIn = Math.min(config.defaultUrlExpiresIn ?? 3600, MAX_TEMPORARY_LINK_DURATION);

        const resolved = resolveAuth(config);

        this.client = resolved.client;
        this.authHandle = resolved.authHandle;

        this.meta = config.metaStorage ?? new DropboxMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): Dropbox {
        return this.client;
    }

    public async create(config: FileInit): Promise<DropboxFile> {
        return this.instrumentOperation("create", async () => {
            const file = new DropboxFile(config);

            file.name = this.namingFunction(file);
            file.path = this.keyToPath(file.name);

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

    public async write(part: FilePart | FileQuery | DropboxFile): Promise<DropboxFile> {
        return this.instrumentOperation("write", async () => {
            let file: DropboxFile;

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
                    const path = file.path ?? this.keyToPath(file.name || file.id);

                    await this.authHandle.ensureAccessToken();

                    const result =
                        buffer.byteLength <= SIMPLE_UPLOAD_LIMIT_BYTES ? await this.uploadSimple(path, buffer) : await this.uploadSession(path, buffer);

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = result.path_display ?? path;
                    file.rev = result.rev;
                    file.ETag = result.rev;
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

    public async delete({ id }: FileQuery): Promise<DropboxFile> {
        return this.instrumentOperation("delete", async () => {
            let file: DropboxFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata — direct path delete
            }

            const path = file?.path ?? this.keyToPath(file?.name ?? id);

            await this.authHandle.ensureAccessToken();

            try {
                await this.client.filesDeleteV2({ path });
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

            return Object.assign(new DropboxFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                id,
                name: id,
                path,
                status: "deleted" as const,
            });
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: DropboxFile | undefined;
            let path = this.keyToPath(id);

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                path = stored.path ?? this.keyToPath(stored.name ?? id);
            } catch {
                // direct path lookup
            }

            await this.authHandle.ensureAccessToken();

            const response = await this.client.filesDownload({ path });
            const data = response.result as files.FileMetadata & { fileBinary?: unknown; fileBlob?: unknown };

            let buffer: Buffer;

            if (data.fileBinary instanceof Uint8Array) {
                buffer = Buffer.from(data.fileBinary.buffer, data.fileBinary.byteOffset, data.fileBinary.byteLength);
            } else if (data.fileBlob instanceof Blob) {
                buffer = Buffer.from(await data.fileBlob.arrayBuffer());
            } else {
                throw new TypeError("Dropbox: unexpected download response shape — neither fileBinary nor fileBlob present");
            }

            return {
                content: buffer,
                contentType: stored?.contentType ?? "application/octet-stream",
                ETag: stored?.ETag ?? data.rev,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? data.server_modified,
                name: stored?.name ?? data.name,
                originalName: stored?.originalName ?? data.name,
                size: stored?.size ?? data.size ?? buffer.length,
            };
        });
    }

    public async copy(name: string, destination: string): Promise<DropboxFile> {
        return this.instrumentOperation("copy", async () => {
            const sourcePath = this.keyToPath(name);
            const targetPath = this.keyToPath(destination);

            await this.authHandle.ensureAccessToken();
            await this.client.filesCopyV2({ from_path: sourcePath, to_path: targetPath });

            const file = new DropboxFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = targetPath;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<DropboxFile> {
        return this.instrumentOperation("move", async () => {
            const sourcePath = this.keyToPath(name);
            const targetPath = this.keyToPath(destination);

            await this.authHandle.ensureAccessToken();
            await this.client.filesMoveV2({ from_path: sourcePath, to_path: targetPath });

            const file = new DropboxFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = targetPath;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000): Promise<DropboxFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                await this.authHandle.ensureAccessToken();

                const response = await this.client.filesListFolder({
                    limit,
                    path: this.rootFolderPath ? `/${this.rootFolderPath}` : "",
                    recursive: true,
                });
                const { result } = response;
                const files: DropboxFile[] = [];

                for (const entry of result.entries) {
                    const tag = (entry as { ".tag"?: string })[".tag"];

                    if (tag !== "file") {
                        continue;
                    }

                    const item = entry as files.FileMetadataReference;
                    const path = item.path_display ?? item.path_lower ?? `/${item.name}`;
                    const key = this.pathToKey(path);

                    if (!key) {
                        continue;
                    }

                    const file = new DropboxFile({
                        contentType: "application/octet-stream",
                        metadata: {},
                        originalName: item.name,
                    });

                    file.id = key;
                    file.name = key;
                    file.path = path;
                    file.size = item.size;
                    file.rev = item.rev;
                    file.ETag = item.rev;
                    file.modifiedAt = item.server_modified;

                    files.push(file);
                }

                return files;
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
                "Dropbox: `responseContentDisposition` is not supported — Dropbox temporary links have no Content-Disposition override.",
            );
        }

        const expiresIn = options?.expiresIn ?? this.defaultUrlExpiresIn;

        if (expiresIn > MAX_TEMPORARY_LINK_DURATION) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                `Dropbox: \`expiresIn\` of ${expiresIn}s exceeds the ${MAX_TEMPORARY_LINK_DURATION}s (4h) maximum. Use \`publicByDefault: true\` for a permanent shared link.`,
            );
        }

        await this.authHandle.ensureAccessToken();

        if (this.publicByDefault) {
            return await this.createPublicSharedLink(key);
        }

        const response = await this.client.filesGetTemporaryLink({ path: this.keyToPath(key) });

        return response.result.link;
    }

    // eslint-disable-next-line class-methods-use-this -- override of the base contract; signals "not supported" without instance state
    public override async getUploadUrl(_key: string, _options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        return throwErrorCode(
            ERRORS.METHOD_NOT_ALLOWED,
            "Dropbox: presigned upload URLs use POST with a raw body, which doesn't fit the PUT-style upload-url contract. " +
                "Use `write()` or `storage.raw.filesGetTemporaryUploadLink(...)` directly.",
        );
    }

    private keyToPath(key: string): string {
        const inner = trimSlashes(key);
        const parts: string[] = [];

        if (this.rootFolderPath) {
            parts.push(this.rootFolderPath);
        }

        if (inner) {
            parts.push(inner);
        }

        return parts.length === 0 ? "" : `/${parts.join("/")}`;
    }

    private pathToKey(path: string): string {
        const inner = trimSlashes(path);

        if (!this.rootFolderPath) {
            return inner;
        }

        if (inner === this.rootFolderPath) {
            return "";
        }

        const prefix = `${this.rootFolderPath}/`;

        return inner.startsWith(prefix) ? inner.slice(prefix.length) : inner;
    }

    private async uploadSimple(path: string, data: Buffer): Promise<files.FileMetadata> {
        const response = await this.client.filesUpload({
            contents: data,
            mode: { ".tag": "overwrite" },
            mute: true,
            path,
        });

        return response.result;
    }

    private async uploadSession(path: string, data: Buffer): Promise<files.FileMetadata> {
        const total = data.byteLength;
        let offset = 0;
        const start = await this.client.filesUploadSessionStart({
            close: false,
            contents: data.subarray(offset, Math.min(offset + UPLOAD_SESSION_CHUNK_BYTES, total)),
        });
        const sessionId = start.result.session_id;

        offset = Math.min(offset + UPLOAD_SESSION_CHUNK_BYTES, total);

        while (total - offset > UPLOAD_SESSION_CHUNK_BYTES) {
            const chunk = data.subarray(offset, offset + UPLOAD_SESSION_CHUNK_BYTES);

            await this.client.filesUploadSessionAppendV2({
                close: false,
                contents: chunk,
                cursor: { offset, session_id: sessionId },
            });
            offset += UPLOAD_SESSION_CHUNK_BYTES;
        }

        const tail = data.subarray(offset, total);
        const finish = await this.client.filesUploadSessionFinish({
            commit: { mode: { ".tag": "overwrite" }, mute: true, path },
            contents: tail,
            cursor: { offset, session_id: sessionId },
        });

        return finish.result;
    }

    private async createPublicSharedLink(key: string): Promise<string> {
        try {
            const response = await this.client.sharingCreateSharedLinkWithSettings({
                path: this.keyToPath(key),
                settings: { requested_visibility: { ".tag": "public" } },
            });

            return rewriteSharedLinkForDirectDownload((response.result as { url: string }).url);
        } catch (error) {
            if (error instanceof DropboxResponseError) {
                const existing = (error.error as { shared_link_already_exists?: { metadata?: { url?: string } } })?.shared_link_already_exists?.metadata?.url;

                if (typeof existing === "string" && existing.length > 0) {
                    return rewriteSharedLinkForDirectDownload(existing);
                }
            }

            throw error;
        }
    }

    private internalOnComplete = (file: DropboxFile): Promise<void> => this.deleteMeta(file.id);
}

const isNotFoundError = (error: unknown): boolean => {
    if (!(error instanceof DropboxResponseError)) {
        return false;
    }

    if (error.status === 404) {
        return true;
    }

    const tags: string[] = [];
    const walk = (node: unknown, depth: number): void => {
        if (depth > 6 || node === null || typeof node !== "object") {
            return;
        }

        const object = node as Record<string, unknown>;
        const tag = object[".tag"];

        if (typeof tag === "string") {
            tags.push(tag);
        }

        for (const value of Object.values(object)) {
            if (value && typeof value === "object") {
                walk(value, depth + 1);
            }
        }
    };

    walk(error.error, 0);

    return tags.includes("not_found") || tags.includes("not_file") || tags.includes("not_folder");
};

export default DropboxStorage;
