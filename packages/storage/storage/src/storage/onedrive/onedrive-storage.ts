import type { AuthenticationProvider, Client as GraphClient } from "@microsoft/microsoft-graph-client";
import { Client, GraphError, ResponseType } from "@microsoft/microsoft-graph-client";

import { ERRORS, throwErrorCode, wrapStorageError } from "../../utils/errors";
import { createOAuthRefreshHandle } from "../../utils/oauth-refresh";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import OneDriveFile from "./onedrive-file";
import OneDriveMetaStorage from "./onedrive-meta-storage";
import type { OneDriveStorageOptions } from "./types";

const GRAPH_DEFAULT_SCOPE = "https://graph.microsoft.com/.default";
const SIMPLE_UPLOAD_LIMIT_BYTES = 250 * 1024 * 1024;
const UPLOAD_SESSION_CHUNK_BYTES = 16 * 320 * 1024; // 5 MiB — must be a multiple of 320 KiB; Microsoft recommends 5–10 MB chunks
const COPY_POLL_INTERVAL_MS = 1000;

interface AuthHandle {
    getAccessToken: () => Promise<string>;
}

interface DriveItem {
    "@microsoft.graph.downloadUrl"?: string;
    cTag?: string;
    eTag?: string;
    file?: { mimeType?: string };
    id: string;
    lastModifiedDateTime?: string;
    name: string;
    parentReference?: { driveId?: string; id?: string; path?: string };
    size?: number;
    webUrl?: string;
}

interface UploadSessionResponse {
    expirationDateTime?: string;
    uploadUrl: string;
}

interface CopyMonitorResponse {
    error?: { code?: string; message?: string };
    percentageComplete?: number;
    resourceId?: string;
    status?: "notStarted" | "inProgress" | "completed" | "failed";
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

const encodePathSegments = (path: string): string =>
    path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const createStaticAccessTokenAuth = (token: string): AuthHandle => {
    return {
        getAccessToken: () => Promise.resolve(token),
    };
};

const createCallableAccessTokenAuth = (source: () => string | Promise<string>): AuthHandle => {
    const ensure = async (): Promise<string> => source();

    return { getAccessToken: ensure };
};

interface ClientCredentialsAuthOptions {
    clientId: string;
    clientSecret: string;
    tenantId: string;
}

const createClientCredentialsAuth = (options: ClientCredentialsAuthOptions): AuthHandle =>
    createOAuthRefreshHandle({
        buildBody: () =>
            new URLSearchParams({
                client_id: options.clientId,
                client_secret: options.clientSecret,
                grant_type: "client_credentials",
                scope: GRAPH_DEFAULT_SCOPE,
            }),
        provider: "OneDrive",
        tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(options.tenantId)}/oauth2/v2.0/token`,
    });

interface RefreshTokenAuthOptions {
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
    tenantId?: string;
}

const createRefreshTokenAuth = (options: RefreshTokenAuthOptions): AuthHandle =>
    createOAuthRefreshHandle({
        buildBody: () =>
            new URLSearchParams({
                client_id: options.clientId,
                grant_type: "refresh_token",
                refresh_token: options.refreshToken,
                scope: GRAPH_DEFAULT_SCOPE,
                ...(options.clientSecret && { client_secret: options.clientSecret }),
            }),
        provider: "OneDrive",
        tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(options.tenantId ?? "common")}/oauth2/v2.0/token`,
    });

const makeAuthProvider = (handle: AuthHandle): AuthenticationProvider => {
    return {
        getAccessToken: () => handle.getAccessToken(),
    };
};

const resolveAuth = (options: OneDriveStorageOptions): GraphClient => {
    if (options.client) {
        return options.client;
    }

    const explicitToken = options.accessToken !== undefined;
    const explicitClientCreds = options.clientCredentials !== undefined;
    const explicitOAuth = options.oauth !== undefined;
    const chosen = [explicitToken, explicitClientCreds, explicitOAuth].filter(Boolean).length;

    if (chosen > 1) {
        throw new Error("OneDrive storage: pass exactly one of `accessToken`, `clientCredentials`, or `oauth`.");
    }

    let handle: AuthHandle | undefined;

    if (options.accessToken !== undefined) {
        handle =
            typeof options.accessToken === "function" ? createCallableAccessTokenAuth(options.accessToken) : createStaticAccessTokenAuth(options.accessToken);
    } else if (options.clientCredentials) {
        handle = createClientCredentialsAuth(options.clientCredentials);
    } else if (options.oauth) {
        handle = createRefreshTokenAuth({
            clientId: options.oauth.clientId,
            refreshToken: options.oauth.refreshToken,
            ...(options.oauth.clientSecret && { clientSecret: options.oauth.clientSecret }),
            ...(options.oauth.tenantId && { tenantId: options.oauth.tenantId }),
        });
    }

    if (!handle) {
        const envAccessToken = process.env.ONEDRIVE_ACCESS_TOKEN;

        if (envAccessToken) {
            handle = createStaticAccessTokenAuth(envAccessToken);
        } else {
            const envClientId = process.env.ONEDRIVE_CLIENT_ID;
            const envClientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
            const envTenantId = process.env.ONEDRIVE_TENANT_ID;
            const envRefreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;

            if (envRefreshToken && envClientId) {
                handle = createRefreshTokenAuth({
                    clientId: envClientId,
                    refreshToken: envRefreshToken,
                    ...(envClientSecret && { clientSecret: envClientSecret }),
                    ...(envTenantId && { tenantId: envTenantId }),
                });
            } else if (envClientId && envClientSecret && envTenantId) {
                handle = createClientCredentialsAuth({
                    clientId: envClientId,
                    clientSecret: envClientSecret,
                    tenantId: envTenantId,
                });
            }
        }
    }

    if (!handle) {
        throw new Error(
            "OneDrive storage: missing auth. Pass `client`, `accessToken`, `clientCredentials`, or `oauth`. " +
                "Env fallbacks: ONEDRIVE_ACCESS_TOKEN; or ONEDRIVE_REFRESH_TOKEN + ONEDRIVE_CLIENT_ID (+ optional ONEDRIVE_CLIENT_SECRET, ONEDRIVE_TENANT_ID); " +
                "or ONEDRIVE_CLIENT_ID + ONEDRIVE_CLIENT_SECRET + ONEDRIVE_TENANT_ID.",
        );
    }

    return Client.initWithMiddleware({ authProvider: makeAuthProvider(handle) });
};

const isNotFoundError = (error: unknown): boolean => {
    if (error instanceof GraphError) {
        return error.statusCode === 404 || error.code === "itemNotFound";
    }

    if (error && typeof error === "object") {
        const object = error as { code?: string; status?: number; statusCode?: number };

        return object.statusCode === 404 || object.status === 404 || object.code === "itemNotFound";
    }

    return false;
};

/* eslint-disable jsdoc/check-indentation -- bullet-list continuations are indented for readability */

/**
 * OneDrive / SharePoint storage backend (Microsoft Graph).
 *
 * Routes virtual keys onto items under `rootFolderPath` in the target drive.
 * Uploads use a single `PUT :/content` request up to 250 MB and switch to
 * Microsoft Graph upload sessions above that threshold.
 *
 * **Auth precedence**:
 * 1. `client` (pre-built `@microsoft/microsoft-graph-client` `Client`)
 * 2. `accessToken` (string or `() => string | Promise&lt;string>`)
 * 3. `clientCredentials` (`tenantId` + `clientId` + `clientSecret`) — app-only
 * 4. `oauth` (`refreshToken` + `clientId` [+ `clientSecret`, `tenantId`]) — delegated
 * 5. Env fallback: `ONEDRIVE_ACCESS_TOKEN`; or `ONEDRIVE_REFRESH_TOKEN` +
 *    `ONEDRIVE_CLIENT_ID` (+ optional `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT_ID`);
 *    or `ONEDRIVE_CLIENT_ID` + `ONEDRIVE_CLIENT_SECRET` + `ONEDRIVE_TENANT_ID`.
 *
 * **Targeting**: at most one of `driveId`, `siteId`, `userId`. With no
 * targeting and delegated auth, defaults to `/me/drive`. App-only auth
 * (`clientCredentials`) cannot use `/me/drive` — pick a target explicitly.
 *
 * **Limitations**:
 * - `cacheControl` is not supported.
 * - `metadata` is preserved via the local metafile only; Graph does not store
 *   arbitrary key/value metadata on `driveItem`.
 * - `getUploadUrl` returns an upload-session URL — clients should `PUT` chunks
 *   directly to it with `Content-Range` headers (not a PUT-with-body URL).
 * - `responseContentDisposition` and `responseContentType` are not supported
 *   on signed download URLs (Graph downloadUrls have no overrides).
 * - `write()` buffers the full part body in memory before deciding between
 *   simple `PUT :/content` and upload-session paths. For multi-GB transfers
 *   prefer `getUploadUrl()` and stream chunks directly to the returned
 *   upload-session URL from the client.
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */
class OneDriveStorage extends BaseStorage<OneDriveFile> {
    public static override readonly name: string = "onedrive";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<OneDriveFile>;

    private readonly basePath: string;

    private readonly client: GraphClient;

    private readonly copyTimeoutMs: number;

    private readonly publicByDefault: boolean;

    private readonly rootFolderPath: string;

    public constructor(config: OneDriveStorageOptions) {
        super(config);

        const targets = [config.driveId, config.siteId, config.userId].filter((value) => value !== undefined);

        if (targets.length > 1) {
            throw new Error("OneDrive storage: pass at most one of `driveId`, `siteId`, or `userId`.");
        }

        if (config.driveId) {
            this.basePath = `/drives/${encodeURIComponent(config.driveId)}`;
        } else if (config.siteId) {
            this.basePath = `/sites/${encodeURIComponent(config.siteId)}/drive`;
        } else if (config.userId) {
            this.basePath = `/users/${encodeURIComponent(config.userId)}/drive`;
        } else {
            if (config.clientCredentials) {
                throw new Error("OneDrive storage: `clientCredentials` (app-only) auth requires `driveId`, `siteId`, or `userId`.");
            }

            this.basePath = "/me/drive";
        }

        this.rootFolderPath = trimSlashes(config.rootFolderPath ?? "");
        this.publicByDefault = config.publicByDefault ?? false;
        this.copyTimeoutMs = config.copyTimeoutMs ?? 60_000;

        this.client = resolveAuth(config);

        this.meta = config.metaStorage ?? new OneDriveMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): GraphClient {
        return this.client;
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<OneDriveFile> {
        return this.instrumentOperation("create", async () => {
            const file = new OneDriveFile(config);

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

    public async write(part: FilePart | FileQuery | OneDriveFile, options?: OperationOptions): Promise<OneDriveFile> {
        return this.instrumentOperation("write", async () => {
            let file: OneDriveFile;

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

                    const item =
                        buffer.byteLength <= SIMPLE_UPLOAD_LIMIT_BYTES
                            ? await this.uploadSimple(key, buffer, file.contentType, options)
                            : await this.uploadSession(key, buffer, file.contentType, options);

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.driveItemId = item.id;
                    file.webUrl = item.webUrl;
                    file.eTag = item.eTag;
                    file.ETag = item.eTag;
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

    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<OneDriveFile> {
        return this.instrumentOperation("delete", async () => {
            let file: OneDriveFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata — direct path delete
            }

            const key = file?.name ?? id;

            try {
                await this.runOperation(options, () => this.client.api(this.itemApiPath(key)).delete());
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

            return Object.assign(new OneDriveFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                id,
                name: id,
                status: "deleted" as const,
            });
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: OneDriveFile | undefined;
            let key = id;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.name ?? id;
            } catch {
                // direct path lookup
            }

            const item = (await this.runOperation(options, () => this.client.api(this.itemApiPath(key)).get())) as DriveItem;
            const arrayBuffer = (await this.runOperation(options, () =>
                this.client.api(this.itemActionPath(key, "content")).responseType(ResponseType.ARRAYBUFFER).get(),
            )) as ArrayBuffer;
            const buffer = Buffer.from(arrayBuffer);

            return {
                content: buffer,
                contentType: stored?.contentType ?? item.file?.mimeType ?? "application/octet-stream",
                ETag: stored?.ETag ?? item.eTag,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? item.lastModifiedDateTime,
                name: stored?.name ?? item.name,
                originalName: stored?.originalName ?? item.name,
                size: stored?.size ?? item.size ?? buffer.length,
            };
        });
    }

    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<OneDriveFile> {
        return this.instrumentOperation("copy", async () => {
            const parentPath = this.parentReferencePath(destination);
            const newName = baseName(destination);
            const body = {
                name: newName,
                parentReference: { path: parentPath },
            };

            const response = (await this.runOperation(options, () =>
                this.client.api(this.itemActionPath(name, "copy")).responseType(ResponseType.RAW).post(body),
            )) as Response;

            if (response.status !== 202) {
                const text = await response.text().catch(() => "");

                throw wrapStorageError(new Error(text || response.statusText), {
                    adapter: "OneDrive",
                    operation: "copy",
                    status: response.status,
                });
            }

            const monitorUrl = response.headers.get("Location");

            if (!monitorUrl) {
                throw wrapStorageError(new Error("response missing Location monitor URL"), {
                    adapter: "OneDrive",
                    code: ERRORS.STORAGE_ERROR,
                    operation: "copy",
                });
            }

            const resourceId = await this.pollCopyMonitor(monitorUrl, options);

            const file = new OneDriveFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.driveItemId = resourceId;

            return file;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<OneDriveFile> {
        return this.instrumentOperation("move", async () => {
            const parentPath = this.parentReferencePath(destination);
            const newName = baseName(destination);

            const moved = (await this.runOperation(options, () =>
                this.client.api(this.itemApiPath(name)).patch({
                    name: newName,
                    parentReference: { path: parentPath },
                }),
            )) as DriveItem;

            const file = new OneDriveFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.driveItemId = moved.id;
            file.webUrl = moved.webUrl;
            file.eTag = moved.eTag;
            file.ETag = moved.eTag;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<OneDriveFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const files: OneDriveFile[] = [];
                let url: string | null = `${this.folderListChildrenPath()}?$top=${Math.min(limit, 1000)}`;

                while (url && files.length < limit) {
                    const page = (await this.runOperation(options, () => this.client.api(url as string).get())) as {
                        "@odata.nextLink"?: string;
                        value: DriveItem[];
                    };

                    for (const item of page.value) {
                        if (!item.file) {
                            continue;
                        }

                        const key = this.itemPathToKey(item);

                        if (!key) {
                            continue;
                        }

                        const file = new OneDriveFile({
                            contentType: item.file.mimeType ?? "application/octet-stream",
                            metadata: {},
                            originalName: item.name,
                        });

                        file.id = key;
                        file.name = key;
                        file.driveItemId = item.id;
                        file.webUrl = item.webUrl;
                        file.eTag = item.eTag;
                        file.ETag = item.eTag;
                        file.size = item.size ?? 0;
                        file.modifiedAt = item.lastModifiedDateTime;

                        files.push(file);

                        if (files.length >= limit) {
                            break;
                        }
                    }

                    url = page["@odata.nextLink"] ?? null;
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
        if (options?.responseContentDisposition || options?.responseContentType) {
            return throwErrorCode(
                ERRORS.METHOD_NOT_ALLOWED,
                "OneDrive: `responseContentDisposition` / `responseContentType` are not supported — Graph download URLs have no overrides.",
            );
        }

        if (this.publicByDefault) {
            const link = (await this.client.api(this.itemActionPath(key, "createLink")).post({
                scope: "anonymous",
                type: "view",
            })) as { link?: { webUrl?: string } };

            const webUrl = link.link?.webUrl;

            if (!webUrl) {
                throw new Error("OneDrive: createLink response missing webUrl");
            }

            return webUrl;
        }

        const item = (await this.client.api(this.itemApiPath(key)).select("@microsoft.graph.downloadUrl").get()) as DriveItem;
        const downloadUrl = item["@microsoft.graph.downloadUrl"];

        if (!downloadUrl) {
            throw new Error("OneDrive: item has no `@microsoft.graph.downloadUrl` — it may be a folder or have no content.");
        }

        return downloadUrl;
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        const session = (await this.client.api(this.itemActionPath(key, "createUploadSession")).post({
            item: {
                "@microsoft.graph.conflictBehavior": "replace",
                ...(options?.contentType && { file: { mimeType: options.contentType } }),
            },
        })) as UploadSessionResponse;

        if (!session.uploadUrl) {
            throw wrapStorageError(new Error("createUploadSession response missing uploadUrl"), {
                adapter: "OneDrive",
                code: ERRORS.STORAGE_ERROR,
                operation: "getUploadUrl",
            });
        }

        return session.uploadUrl;
    }

    private keyParts(key: string): string[] {
        const inner = trimSlashes(key);
        const parts: string[] = [];

        if (this.rootFolderPath) {
            parts.push(this.rootFolderPath);
        }

        if (inner) {
            parts.push(inner);
        }

        return parts;
    }

    private itemApiPath(key: string): string {
        const parts = this.keyParts(key);

        if (parts.length === 0) {
            return `${this.basePath}/root`;
        }

        return `${this.basePath}/root:/${encodePathSegments(parts.join("/"))}`;
    }

    private itemActionPath(key: string, action: string): string {
        const parts = this.keyParts(key);

        if (parts.length === 0) {
            return `${this.basePath}/root/${action}`;
        }

        return `${this.basePath}/root:/${encodePathSegments(parts.join("/"))}:/${action}`;
    }

    private folderListChildrenPath(): string {
        return this.itemActionPath("", "children");
    }

    /**
     * Build a `parentReference.path` for move/copy. Microsoft Graph requires
     * this path to be relative to the drive, prefixed with `/drive/root:` —
     * **not** with the configured base path (`/me/drive`, `/drives/{id}`, …).
     */
    private parentReferencePath(key: string): string {
        const inner = trimSlashes(key);
        const parts: string[] = [];

        if (this.rootFolderPath) {
            parts.push(this.rootFolderPath);
        }

        const last = inner.lastIndexOf("/");

        if (last !== -1) {
            const folder = inner.slice(0, last);

            if (folder) {
                parts.push(folder);
            }
        }

        if (parts.length === 0) {
            return "/drive/root:";
        }

        return `/drive/root:/${encodePathSegments(parts.join("/"))}`;
    }

    private itemPathToKey(item: DriveItem): string {
        const parentPath = item.parentReference?.path ?? "";
        const rootMarker = "/root:";
        const index = parentPath.indexOf(rootMarker);
        let folder = index === -1 ? "" : parentPath.slice(index + rootMarker.length);

        folder = trimSlashes(decodeURIComponent(folder));

        const stripped = this.rootFolderPath && folder.startsWith(this.rootFolderPath) ? folder.slice(this.rootFolderPath.length) : folder;

        const cleanFolder = trimSlashes(stripped);

        return cleanFolder ? `${cleanFolder}/${item.name}` : item.name;
    }

    private async uploadSimple(key: string, data: Buffer, contentType?: string, options?: OperationOptions): Promise<DriveItem> {
        const result = (await this.runOperation(options, () =>
            this.client
                .api(`${this.itemActionPath(key, "content")}?@microsoft.graph.conflictBehavior=replace`)
                .header("Content-Type", contentType ?? "application/octet-stream")
                .put(data),
        )) as DriveItem;

        return result;
    }

    private async uploadSession(key: string, data: Buffer, contentType?: string, options?: OperationOptions): Promise<DriveItem> {
        const session = (await this.runOperation(options, () =>
            this.client.api(this.itemActionPath(key, "createUploadSession")).post({
                item: {
                    "@microsoft.graph.conflictBehavior": "replace",
                    ...(contentType && { file: { mimeType: contentType } }),
                },
            }),
        )) as UploadSessionResponse;

        const total = data.byteLength;
        let offset = 0;
        let final: DriveItem | undefined;

        while (offset < total) {
            const end = Math.min(offset + UPLOAD_SESSION_CHUNK_BYTES, total);
            const chunk = data.subarray(offset, end);

            const response = await this.runOperation(options, () =>
                fetch(session.uploadUrl, {
                    body: new Uint8Array(chunk),
                    headers: {
                        "Content-Length": String(chunk.byteLength),
                        "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
                    },
                    method: "PUT",
                }),
            );

            if (response.status === 200 || response.status === 201) {
                final = (await response.json()) as DriveItem;
            } else if (response.status !== 202) {
                const text = await response.text().catch(() => "");

                throw wrapStorageError(new Error(text || response.statusText), {
                    adapter: "OneDrive",
                    operation: "upload-session chunk",
                    status: response.status,
                });
            }

            offset = end;
        }

        if (!final) {
            throw wrapStorageError(new Error("upload-session terminated without a final DriveItem response"), {
                adapter: "OneDrive",
                code: ERRORS.STORAGE_ERROR,
                operation: "write",
            });
        }

        return final;
    }

    private async pollCopyMonitor(monitorUrl: string, options?: OperationOptions): Promise<string | undefined> {
        const deadline = Date.now() + this.copyTimeoutMs;

        while (true) {
            const response = await this.runOperation(options, () => fetch(monitorUrl));

            if (!response.ok) {
                throw wrapStorageError(new Error(response.statusText), {
                    adapter: "OneDrive",
                    operation: "copy monitor",
                    status: response.status,
                });
            }

            const body = (await response.json()) as CopyMonitorResponse;

            if (body.status === "completed") {
                return body.resourceId;
            }

            if (body.status === "failed") {
                throw wrapStorageError(new Error(body.error?.message ?? "unknown error"), {
                    adapter: "OneDrive",
                    code: ERRORS.STORAGE_ERROR,
                    operation: "copy",
                });
            }

            if (Date.now() >= deadline) {
                throw new Error(`OneDrive: copy timed out after ${this.copyTimeoutMs}ms (status: ${body.status ?? "unknown"})`);
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, COPY_POLL_INTERVAL_MS);
            });
        }
    }

    private internalOnComplete = (file: OneDriveFile): Promise<void> => this.deleteMeta(file.id);
}

const baseName = (key: string): string => {
    const trimmed = trimSlashes(key);
    const index = trimmed.lastIndexOf("/");

    return index === -1 ? trimmed : trimmed.slice(index + 1);
};

/**
 * Builds a Microsoft Graph `Client` from the OneDrive auth options (same
 * precedence as the constructor). Exposed so the SharePoint adapter can
 * resolve a site/document library to a `driveId` before delegating to an
 * inner `OneDriveStorage`, without duplicating the auth-building logic.
 */
export const buildGraphClient = (options: OneDriveStorageOptions): GraphClient => resolveAuth(options);

export default OneDriveStorage;
