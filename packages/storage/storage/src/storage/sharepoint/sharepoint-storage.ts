import type { Readable } from "node:stream";

import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import OneDriveStorage, { buildGraphClient } from "../onedrive/onedrive-storage";
import type { OneDriveStorageOptions } from "../onedrive/types";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import type SharePointFile from "./sharepoint-file";
import SharePointMetaStorage from "./sharepoint-meta-storage";
import type { SharePointStorageOptions } from "./types";

interface SiteResponse {
    id: string;
}

interface DriveResponse {
    id: string;
}

interface DrivesListResponse {
    value: { id: string; name?: string; webUrl?: string }[];
}

/**
 * The last path segment of a drive's `webUrl`, decoded. Graph's `drive.name`
 * is the *localized display name* (e.g. "Documents"), whereas the `webUrl`
 * ends with the stable URL name (e.g. ".../Shared%20Documents"). Matching
 * against both lets a configured `documentLibrary` resolve on renamed or
 * non-English tenants.
 */
const webUrlLeaf = (webUrl: string | undefined): string | undefined => {
    if (!webUrl) {
        return undefined;
    }

    const segment = webUrl.replace(/\/+$/, "").split("/").pop();

    if (!segment) {
        return undefined;
    }

    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

/**
 * Parse a full SharePoint site URL into a Graph hostname + server-relative
 * path pair, e.g. `https://contoso.sharepoint.com/sites/Marketing` →
 * `{ hostname: "contoso.sharepoint.com", sitePath: "/sites/Marketing" }`.
 */
const parseSiteUrl = (siteUrl: string): { hostname: string; sitePath: string } => {
    let parsed: URL;

    try {
        parsed = new URL(siteUrl);
    } catch {
        return throwErrorCode(ERRORS.BAD_REQUEST, `SharePoint storage: invalid \`siteUrl\` "${siteUrl}".`);
    }

    const path = parsed.pathname.replace(/\/+$/, "");

    return { hostname: parsed.host, sitePath: path === "" ? "/" : path };
};

/**
 * SharePoint document-library storage backend (Microsoft Graph).
 *
 * A SharePoint document library is a Microsoft Graph drive. This adapter
 * resolves a site + document library to a `driveId` and then delegates every
 * storage operation to an internal {@link OneDriveStorage}. No Graph upload
 * logic is reimplemented here.
 *
 * Site resolution is lazy: the Graph client is built eagerly (so auth errors
 * surface at construction) but the site/library → `driveId` lookup runs on the
 * first storage operation, because resolution is async and constructors cannot
 * be.
 * @example
 * ```ts
 * import { SharePointStorage } from "@visulima/storage/provider/sharepoint";
 *
 * const storage = new SharePointStorage({
 *   siteUrl: "https://contoso.sharepoint.com/sites/Marketing",
 *   documentLibrary: "Documents",
 *   clientCredentials: { tenantId, clientId, clientSecret },
 * });
 * ```
 */
class SharePointStorage extends BaseStorage<SharePointFile> {
    public static override readonly name: string = "sharepoint";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<SharePointFile>;

    private readonly client: GraphClient;

    private inner?: OneDriveStorage;

    private innerPromise?: Promise<OneDriveStorage>;

    private readonly oneDriveAuth: Pick<OneDriveStorageOptions, "accessToken" | "client" | "clientCredentials" | "oauth">;

    private readonly resolvedConfig: SharePointStorageOptions;

    public constructor(config: SharePointStorageOptions) {
        super(config);

        const accessToken = config.accessToken ?? process.env.SHAREPOINT_ACCESS_TOKEN ?? process.env.ONEDRIVE_ACCESS_TOKEN;

        const clientCredentials =
            config.clientCredentials ??
            (() => {
                const tenantId = process.env.SHAREPOINT_TENANT_ID ?? process.env.ONEDRIVE_TENANT_ID;
                const clientId = process.env.SHAREPOINT_CLIENT_ID ?? process.env.ONEDRIVE_CLIENT_ID;
                const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET ?? process.env.ONEDRIVE_CLIENT_SECRET;

                if (tenantId && clientId && clientSecret) {
                    return { clientId, clientSecret, tenantId };
                }

                return undefined;
            })();

        this.oneDriveAuth = {
            ...(config.client && { client: config.client }),
            ...(accessToken !== undefined && { accessToken }),
            ...(clientCredentials && { clientCredentials }),
            ...(config.oauth && { oauth: config.oauth }),
        };

        this.resolvedConfig = {
            ...config,
            ...((config.driveId ?? process.env.SHAREPOINT_DRIVE_ID) ? { driveId: config.driveId ?? process.env.SHAREPOINT_DRIVE_ID } : {}),
            ...((config.siteId ?? process.env.SHAREPOINT_SITE_ID) ? { siteId: config.siteId ?? process.env.SHAREPOINT_SITE_ID } : {}),
            ...((config.siteUrl ?? process.env.SHAREPOINT_SITE_URL) ? { siteUrl: config.siteUrl ?? process.env.SHAREPOINT_SITE_URL } : {}),
            ...((config.hostname ?? process.env.SHAREPOINT_HOSTNAME) ? { hostname: config.hostname ?? process.env.SHAREPOINT_HOSTNAME } : {}),
        };

        // Build the Graph client eagerly using OneDrive's auth precedence so
        // auth misconfiguration throws at construction. The same client is
        // reused for site/library resolution.
        this.client = buildGraphClient(this.oneDriveAuth);

        this.meta = config.metaStorage ?? new SharePointMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): GraphClient {
        return this.client;
    }

    public async create(config: FileInit): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.create(config);
    }

    public async write(part: FilePart | FileQuery | SharePointFile): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.write(part);
    }

    public async delete(query: FileQuery): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.delete(query);
    }

    public async get(query: FileQuery): Promise<FileReturn> {
        const inner = await this.getInner();

        return inner.get(query);
    }

    public async copy(name: string, destination: string): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.copy(name, destination);
    }

    public async move(name: string, destination: string): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.move(name, destination);
    }

    public override async exists(query: FileQuery): Promise<boolean> {
        const inner = await this.getInner();

        return inner.exists(query);
    }

    public override async list(limit = 1000): Promise<SharePointFile[]> {
        const inner = await this.getInner();

        return inner.list(limit);
    }

    public override async update(query: FileQuery, metadata: Partial<SharePointFile>): Promise<SharePointFile> {
        const inner = await this.getInner();

        return inner.update(query, metadata);
    }

    public override async getStream(query: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        const inner = await this.getInner();

        return inner.getStream(query);
    }

    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        const inner = await this.getInner();

        return inner.getReadUrl(key, options);
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        const inner = await this.getInner();

        return inner.getUploadUrl(key, options);
    }

    /**
     * Resolve the target document library to a `driveId` and construct the
     * internal {@link OneDriveStorage}. Memoized so resolution runs at most
     * once.
     */
    private async getInner(): Promise<OneDriveStorage> {
        if (this.inner) {
            return this.inner;
        }

        this.innerPromise ??= this.buildInner();

        this.inner = await this.innerPromise;

        return this.inner;
    }

    private async buildInner(): Promise<OneDriveStorage> {
        const driveId = await this.resolveDriveId();

        // Strip SharePoint-only site-targeting fields from the inherited base
        // config so OneDrive sees a single target (`driveId`).
        const { documentLibrary, hostname, siteId, sitePath, siteUrl, ...baseConfig } = this.genericConfig as SharePointStorageOptions;

        const inner = new OneDriveStorage({
            ...(baseConfig as OneDriveStorageOptions),
            ...this.oneDriveAuth,
            driveId,
            ...(this.resolvedConfig.copyTimeoutMs !== undefined && { copyTimeoutMs: this.resolvedConfig.copyTimeoutMs }),
            ...(this.resolvedConfig.metaStorageConfig && { metaStorageConfig: this.resolvedConfig.metaStorageConfig }),
            metaStorage: this.meta,
            ...(this.resolvedConfig.publicByDefault !== undefined && { publicByDefault: this.resolvedConfig.publicByDefault }),
            ...(this.resolvedConfig.rootFolderPath !== undefined && { rootFolderPath: this.resolvedConfig.rootFolderPath }),
        });

        return inner;
    }

    private async resolveDriveId(): Promise<string> {
        const config = this.resolvedConfig;

        if (config.driveId) {
            return config.driveId;
        }

        const siteId = await this.resolveSiteId();

        if (config.documentLibrary) {
            const drives = (await this.client.api(`/sites/${siteId}/drives`).get()) as DrivesListResponse;
            const wanted = config.documentLibrary.toLowerCase();
            const match =
                (drives.value ?? []).find((drive) => drive.name === config.documentLibrary) ??
                (drives.value ?? []).find(
                    (drive) => drive.name?.toLowerCase() === wanted || webUrlLeaf(drive.webUrl)?.toLowerCase() === wanted,
                );

            if (!match) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND, `SharePoint storage: document library "${config.documentLibrary}" not found in site "${siteId}".`);
            }

            return match.id;
        }

        const drive = (await this.client.api(`/sites/${siteId}/drive`).get()) as DriveResponse;

        if (!drive?.id) {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND, `SharePoint storage: site "${siteId}" has no default drive.`);
        }

        return drive.id;
    }

    private async resolveSiteId(): Promise<string> {
        const config = this.resolvedConfig;

        if (config.siteId) {
            return config.siteId;
        }

        let hostname: string | undefined;
        let sitePath: string | undefined;

        if (config.siteUrl) {
            ({ hostname, sitePath } = parseSiteUrl(config.siteUrl));
        } else if (config.hostname) {
            hostname = config.hostname;
            sitePath = config.sitePath ?? "/";
        }

        if (!hostname || !sitePath) {
            return throwErrorCode(
                ERRORS.BAD_REQUEST,
                "SharePoint storage: missing site targeting. Provide `driveId`, `siteId`, `siteUrl`, or `hostname` (+ `sitePath`).",
            );
        }

        const normalizedPath = sitePath === "/" ? "" : sitePath.replace(/^\/+/, "");
        const apiPath = normalizedPath ? `/sites/${hostname}:/${normalizedPath}` : `/sites/${hostname}`;

        let site: SiteResponse | undefined;

        try {
            site = (await this.client.api(apiPath).get()) as SiteResponse;
        } catch (error) {
            return throwErrorCode(
                ERRORS.FILE_NOT_FOUND,
                `SharePoint storage: site not found for "${config.siteUrl ?? `${hostname}${sitePath}`}" (${error instanceof Error ? error.message : String(error)}).`,
            );
        }

        if (!site?.id) {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND, `SharePoint storage: site not found for "${config.siteUrl ?? `${hostname}${sitePath}`}".`);
        }

        return site.id;
    }
}

export default SharePointStorage;
