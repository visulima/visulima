import type { Client } from "@microsoft/microsoft-graph-client";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface OneDriveClientCredentialsAuth {
    /**
     * Microsoft Entra (Azure AD) application (client) ID.
     */
    clientId: string;

    /**
     * Application (client) secret.
     */
    clientSecret: string;

    /**
     * Microsoft Entra tenant ID (GUID or domain name).
     */
    tenantId: string;
}

export interface OneDriveOAuthRefreshAuth {
    /**
     * Microsoft Entra application (client) ID.
     */
    clientId: string;

    /**
     * Application client secret. Required for confidential clients (default).
     * Public clients may omit it if the app registration allows.
     */
    clientSecret?: string;

    /**
     * OAuth2 refresh token obtained from an interactive sign-in flow.
     */
    refreshToken: string;

    /**
     * Tenant ID — `"common"`, `"consumers"`, `"organizations"`, or a tenant
     * GUID/domain. Defaults to `"common"`.
     */
    tenantId?: string;
}

export interface OneDriveStorageOptions extends BaseStorageOptions {
    /**
     * Static or dynamic access token. Pass a string for a one-shot token, or
     * a function returning a fresh token on each call.
     */
    accessToken?: string | (() => string | Promise<string>);

    /**
     * Pre-built `@microsoft/microsoft-graph-client` `Client`. Escape hatch for
     * callers that wire up their own `AuthenticationProvider` (e.g. with
     * `@azure/identity` or `@azure/msal-node`).
     */
    client?: Client;

    /**
     * Client-credentials auth — for app-only / daemon scenarios.
     * Cannot be used with `/me/drive`; you must target via `driveId`,
     * `siteId`, or `userId`.
     */
    clientCredentials?: OneDriveClientCredentialsAuth;

    /**
     * Timeout, in milliseconds, for polling the async-copy monitor URL.
     * Defaults to 60_000 (60s).
     */
    copyTimeoutMs?: number;

    /**
     * Target drive by ID. Mutually exclusive with `siteId` and `userId`.
     */
    driveId?: string;

    /**
     * Configure metafiles storage. Defaults to local tmp directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * OAuth2 refresh-token auth — for delegated user scenarios. Exchanges
     * the refresh token at the Microsoft identity platform and caches the
     * resulting access token until ~60s before expiry.
     */
    oauth?: OneDriveOAuthRefreshAuth;

    /**
     * When `true`, `getReadUrl` creates an anonymous shared link with
     * `view` permission. Otherwise it returns the short-lived pre-authenticated
     * `@microsoft.graph.downloadUrl` from the item metadata.
     */
    publicByDefault?: boolean;

    /**
     * Logical "bucket root" — virtual keys live under this folder path within
     * the target drive. Must already exist; the adapter does not create
     * folders. Defaults to drive root.
     */
    rootFolderPath?: string;

    /**
     * Target a SharePoint site's default drive. Mutually exclusive with
     * `driveId` and `userId`.
     */
    siteId?: string;

    /**
     * Target a specific user's drive. Mutually exclusive with `driveId` and
     * `siteId`. Required when using `clientCredentials` auth (Graph does not
     * accept `/me/drive` for app-only tokens).
     */
    userId?: string;
}
