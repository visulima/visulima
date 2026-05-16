import type { Client } from "@microsoft/microsoft-graph-client";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { OneDriveStorageOptions } from "../onedrive/types";
import type { BaseStorageOptions } from "../types";

/**
 * Options for the SharePoint storage backend.
 *
 * A SharePoint document library is a Microsoft Graph drive. This adapter
 * resolves a site + document library down to a `driveId` and then delegates
 * every storage operation to an internal {@link OneDriveStorage}.
 *
 * **Site targeting** (resolved in this order):
 * 1. `driveId` (env `SHAREPOINT_DRIVE_ID`) — short-circuits site resolution.
 * 2. `siteId` (env `SHAREPOINT_SITE_ID`).
 * 3. `siteUrl` (env `SHAREPOINT_SITE_URL`) — parsed into hostname + path.
 * 4. `hostname` (env `SHAREPOINT_HOSTNAME`) + `sitePath`.
 *
 * Once the site is known, `documentLibrary` selects a specific drive from the
 * site's drive list by display name; otherwise the site's default drive is
 * used.
 *
 * **Auth** mirrors {@link OneDriveStorageOptions}. Env fallbacks resolve the
 * `SHAREPOINT_*` variables first and then the matching `ONEDRIVE_*`
 * variables.
 */
export interface SharePointStorageOptions extends BaseStorageOptions {
    /**
     * Static or dynamic access token. Pass a string for a one-shot token, or
     * a function returning a fresh token on each call.
     */
    accessToken?: string | (() => string | Promise<string>);

    /**
     * Pre-built `@microsoft/microsoft-graph-client` `Client`. Escape hatch for
     * callers that wire up their own `AuthenticationProvider` and also used to
     * resolve the site/library when site targeting is required.
     */
    client?: Client;

    /**
     * Client-credentials auth — for app-only / daemon scenarios. Same shape as
     * {@link OneDriveStorageOptions.clientCredentials}.
     */
    clientCredentials?: OneDriveStorageOptions["clientCredentials"];

    /**
     * Timeout, in milliseconds, for polling the async-copy monitor URL.
     * Defaults to 60_000 (60s).
     */
    copyTimeoutMs?: number;

    /**
     * Display name of the document library (drive) to target within the
     * resolved site. When omitted, the site's default drive is used.
     */
    documentLibrary?: string;

    /**
     * Target drive (document library) by ID. Short-circuits site resolution.
     * Env fallback: `SHAREPOINT_DRIVE_ID`.
     */
    driveId?: string;

    /**
     * SharePoint host name (e.g. `contoso.sharepoint.com`). Combined with
     * `sitePath` to resolve the site. Env fallback: `SHAREPOINT_HOSTNAME`.
     */
    hostname?: string;

    /**
     * Configure metafiles storage. Defaults to local tmp directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * OAuth2 refresh-token auth — for delegated user scenarios. Same shape as
     * {@link OneDriveStorageOptions.oauth}.
     */
    oauth?: OneDriveStorageOptions["oauth"];

    /**
     * When `true`, `getReadUrl` creates an anonymous shared link with `view`
     * permission. Otherwise it returns the short-lived pre-authenticated
     * `@microsoft.graph.downloadUrl` from the item metadata.
     */
    publicByDefault?: boolean;

    /**
     * Logical "bucket root" — virtual keys live under this folder path within
     * the target drive. Must already exist. Defaults to drive root.
     */
    rootFolderPath?: string;

    /**
     * Target a SharePoint site by its Graph site ID. Env fallback:
     * `SHAREPOINT_SITE_ID`.
     */
    siteId?: string;

    /**
     * Server-relative site path (e.g. `/sites/Marketing`). Combined with
     * `hostname` to resolve the site.
     */
    sitePath?: string;

    /**
     * Full SharePoint site URL (e.g.
     * `https://contoso.sharepoint.com/sites/Marketing`). Parsed into a host
     * name + server-relative path. Env fallback: `SHAREPOINT_SITE_URL`.
     */
    siteUrl?: string;
}
