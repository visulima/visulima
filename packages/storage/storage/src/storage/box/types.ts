import type { BoxClient } from "box-typescript-sdk-gen";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface BoxOAuthOptions {
    /**
     * Box application client ID.
     */
    clientId: string;

    /**
     * Box application client secret.
     */
    clientSecret: string;

    /**
     * Long-lived refresh token previously obtained via Box's authorization
     * code flow. The adapter seeds the SDK's in-memory token storage with
     * this value; the SDK exchanges it for a fresh access token on first
     * use and re-refreshes when the access token expires.
     */
    refreshToken: string;
}

export interface BoxCcgOptions {
    /**
     * Box application client ID.
     */
    clientId: string;

    /**
     * Box application client secret.
     */
    clientSecret: string;

    /**
     * Pass `enterpriseId` to authenticate as the service account, or `userId`
     * to authenticate as a managed/app user. At least one is required.
     */
    enterpriseId?: string;

    /**
     * Pass `userId` to authenticate as a managed/app user.
     */
    userId?: string;
}

export type BoxJwtOptions =
    | { configFilePath: string }
    | { configJsonString: string };

export interface BoxStorageOptions extends BaseStorageOptions {
    /**
     * Server-side Client Credentials Grant. Mutually exclusive with
     * `developerToken`, `oauth`, and `jwt`.
     */
    ccg?: BoxCcgOptions;

    /**
     * Pre-built `BoxClient`. Escape hatch for callers that already wire
     * auth themselves (e.g. with a custom `NetworkSession`, proxy config,
     * or downscoped tokens).
     */
    client?: BoxClient;

    /**
     * Default expiry, in seconds, advertised to callers of `getReadUrl()`.
     * Box does not document a hard maximum for download URLs (they are
     * short-lived by API design); this value is forwarded as documentation
     * only — the actual lifetime is decided by Box. Defaults to 3600.
     */
    defaultUrlExpiresIn?: number;

    /**
     * Static developer token from the Box developer console. Useful for
     * scripts and trying the adapter; production apps should use OAuth,
     * CCG, or JWT instead. Mutually exclusive with `oauth`, `ccg`, `jwt`.
     */
    developerToken?: string;

    /**
     * JWT Server Authentication, configured via the JSON blob from Box's
     * developer console. Mutually exclusive with the other auth modes.
     */
    jwt?: BoxJwtOptions;

    /**
     * Configure metafiles storage. Defaults to local tmp directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * OAuth2 user-app flow seeded with a refresh token. Mutually exclusive
     * with `developerToken`, `ccg`, and `jwt`.
     */
    oauth?: BoxOAuthOptions;

    /**
     * When `true`, `getReadUrl` creates (or reuses) an `open`-access shared
     * link instead of a short-lived signed download URL. Public shared links
     * may be restricted on Box Business or Enterprise plans; the adapter
     * surfaces Box's `access_denied_insufficient_permissions` error
     * unmodified in that case.
     */
    publicByDefault?: boolean;

    /**
     * Logical "bucket root" — virtual keys live under this Box folder ID.
     * Use `"0"` (the default) to anchor at the user's root folder. The
     * folder must already exist; intermediate subfolders are auto-created
     * on upload.
     */
    rootFolderId?: string;
}
