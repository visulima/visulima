import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

/**
 * Minimal structural type for the PocketBase client used by the adapter.
 * Declared locally so the package does not require `pocketbase` to be
 * installed for type-checking (it is an optional peer dependency).
 */
export interface PocketBaseClientLike {
    authStore: {
        isValid: boolean;
        save: (token: string, model: unknown) => void;
    };
    collection: (name: string) => {
        authWithPassword: (email: string, password: string) => Promise<unknown>;
        create: (body: unknown) => Promise<PocketBaseRecord>;
        delete: (id: string) => Promise<boolean>;
        getFirstListItem: (filter: string) => Promise<PocketBaseRecord>;
        getList: (page: number, perPage: number) => Promise<{ items: PocketBaseRecord[] }>;
        update: (id: string, body: unknown) => Promise<PocketBaseRecord>;
    };
    files: {
        getToken: () => Promise<string>;
        getURL?: (record: PocketBaseRecord, filename: string, options?: { token?: string }) => string;
        getUrl?: (record: PocketBaseRecord, filename: string, options?: { token?: string }) => string;
    };
    filter: (raw: string, parameters?: Record<string, unknown>) => string;
}

/**
 * Minimal structural type for a PocketBase record. The file field holds the
 * stored filename string; the key field holds the logical object key.
 */
export interface PocketBaseRecord {
    [field: string]: unknown;
    id: string;
}

export interface PocketBaseStorageOptions extends BaseStorageOptions {
    /**
     * Superuser email used for lazy authentication. Ignored when `client` or
     * `authToken` is supplied. Falls back to `POCKETBASE_ADMIN_EMAIL`.
     */
    adminEmail?: string;

    /**
     * Superuser password used for lazy authentication. Ignored when `client`
     * or `authToken` is supplied. Falls back to `POCKETBASE_ADMIN_PASSWORD`.
     */
    adminPassword?: string;

    /**
     * Pre-saved auth token stored on the client's `authStore`. Ignored when
     * `client` is supplied. Falls back to `POCKETBASE_AUTH_TOKEN`.
     */
    authToken?: string;

    /**
     * Pre-built `PocketBase` instance. Mutually exclusive with `url`. When
     * supplied it is used as-is and no authentication is performed.
     */
    client?: PocketBaseClientLike;

    /**
     * Collection name backing the object store. Each record holds exactly one
     * file. Required — the adapter does not create the collection.
     */
    collection: string;

    /**
     * Default expiry, in seconds, for `getReadUrl`. PocketBase file tokens are
     * short-lived; a fresh token is requested per call. Defaults to 3600.
     */
    defaultUrlExpiresIn?: number;

    /**
     * File field on the collection holding the stored file. Defaults to `file`.
     */
    fileField?: string;

    /**
     * Text field on the collection holding the logical object key. Defaults
     * to `key`.
     */
    keyField?: string;

    /**
     * Configure metafiles storage. Used for TUS-style resumable upload
     * bookkeeping. Defaults to {@link LocalMetaStorage} under the OS tmp
     * directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Public base URL for served files. When set, `getReadUrl` returns
     * `${publicBaseUrl}/${key}` without requesting a file token.
     */
    publicBaseUrl?: string;

    /**
     * PocketBase instance URL (e.g. `https://pb.example.com`). Ignored when
     * `client` is supplied. Falls back to `POCKETBASE_URL`.
     */
    url?: string;
}
