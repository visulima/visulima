import type { Dropbox } from "dropbox";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface DropboxStorageOptions extends BaseStorageOptions {
    /**
     * Static or dynamic access token. Pass a string for a one-shot token, or
     * a function returning a fresh token on each call. The adapter does not
     * cache the result of a callable — your callable is responsible for
     * caching/refresh.
     */
    accessToken?: string | (() => string | Promise<string>);

    /**
     * Dropbox app key (client_id). Required when `refreshToken` is set.
     */
    appKey?: string;

    /**
     * Dropbox app secret (client_secret). Required for confidential clients.
     */
    appSecret?: string;

    /**
     * Pre-built `Dropbox` client. Escape hatch for callers that already wire
     * auth themselves (e.g. with team-space `pathRoot`, custom headers, or a
     * shared `DropboxAuth`).
     */
    client?: Dropbox;

    /**
     * Default expiry, in seconds, for temporary download links from
     * `getReadUrl()`. Capped at 14400 (4 hours, the Dropbox maximum).
     * Defaults to 3600 (1 hour).
     */
    defaultUrlExpiresIn?: number;

    /**
     * Configure metafiles storage. Defaults to local tmp directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * When `true`, `getReadUrl` creates a public shared link instead of a
     * temporary 4-hour link. The link is rewritten to `?dl=1` so it serves
     * raw bytes directly.
     */
    publicByDefault?: boolean;

    /**
     * OAuth2 refresh token. When set, the adapter exchanges it for fresh
     * access tokens at `https://api.dropboxapi.com/oauth2/token` and caches
     * them until ~60s before expiry. Requires `appKey` (PKCE) or `appKey` +
     * `appSecret` (confidential client).
     */
    refreshToken?: string;

    /**
     * Logical "bucket root" — virtual keys live under this folder path. Must
     * already exist; the adapter does not create folders. Path is normalized:
     * leading slash is added, trailing slashes stripped. Defaults to account
     * root.
     */
    rootFolderPath?: string;
}
