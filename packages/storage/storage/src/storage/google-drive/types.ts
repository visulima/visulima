import type { drive_v3 } from "@googleapis/drive";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface GoogleDriveStorageOptions extends BaseStorageOptions {
    /**
     * Pre-built `@googleapis/drive` v3 client. Escape hatch for callers that
     * have already wired auth (workload identity, ADC, etc.). When set, the
     * adapter uses it directly and `getUploadUrl()` will throw because there's
     * no stable way to recover the underlying auth handle.
     */
    client?: drive_v3.Drive;

    /**
     * Inline service-account credentials. Mints a `JWT` auth client with
     * `https://www.googleapis.com/auth/drive` scope. Mutually exclusive with
     * the other auth shapes.
     */
    credentials?: { client_email: string; private_key: string };

    /**
     * Shared Drive id. **Strongly recommended for service-account auth** —
     * service accounts have a 15 GB personal quota; production workloads
     * should target a Shared Drive with the service account added as a member.
     */
    driveId?: string;

    /**
     * LRU capacity for the in-memory virtual-key → fileId cache. Drive has
     * no native key field; every read after the first round-trips a
     * `files.list` to resolve the id, which the cache amortizes. Defaults to
     * 1024.
     */
    fileIdCacheSize?: number;

    /**
     * Path to a service-account JSON file. Mutually exclusive with the other
     * auth shapes.
     */
    keyFilename?: string;

    /**
     * Configure metafiles storage. Defaults to local tmp directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * OAuth refresh token (3-legged OAuth, end-user Drive). The adapter mints
     * fresh access tokens against `clientId`/`clientSecret`. Mutually
     * exclusive with the other auth shapes.
     */
    oauth?: { clientId: string; clientSecret: string; refreshToken: string };

    /**
     * When `true`, `write()` also creates an "anyone with link, reader"
     * permission and `getReadUrl()` returns the Drive public download URL.
     * When `false` (default), `getReadUrl()` throws — Drive has no signed-URL
     * primitive.
     */
    publicByDefault?: boolean;

    /**
     * Logical "bucket root" — virtual keys live under this folder. Defaults
     * to `"root"` (My Drive root) or, when `driveId` is set, the Shared
     * Drive root id should be used here.
     */
    rootFolderId?: string;

    /**
     * Domain-wide delegation subject (the user to impersonate). Only honored
     * with `credentials` or `keyFilename`.
     */
    subject?: string;
}
