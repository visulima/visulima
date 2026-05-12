import type { UTApi } from "uploadthing/server";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface UploadThingStorageOptions extends BaseStorageOptions {
    /**
     * ACL applied to uploads. Drives `getReadUrl` behavior — `"public-read"`
     * returns the permanent CDN URL, `"private"` mints a short-lived signed
     * URL via `generateSignedURL`. Defaults to `"public-read"`.
     */
    acl?: "private" | "public-read";

    /**
     * Pre-built `UTApi` instance. Use this to share an instance, customize
     * `fetch`, or inject test stubs. Mutually exclusive with `token`.
     */
    client?: UTApi;

    /**
     * Default expiry (seconds) for `getReadUrl` when `acl` is `"private"`.
     * Capped at 7 days (UploadThing maximum). Defaults to 3600 (1 hour).
     */
    defaultUrlExpiresIn?: number;

    /**
     * Configure metafiles storage for resumable-upload bookkeeping.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * UploadThing token (base64-encoded JSON: `{ apiKey, appId, regions[] }`).
     * Falls back to `UPLOADTHING_TOKEN`. Ignored when `client` is supplied.
     */
    token?: string;
}
