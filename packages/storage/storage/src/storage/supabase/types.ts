import type { StorageClient } from "@supabase/storage-js";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface SupabaseStorageOptions extends BaseStorageOptions {
    /**
     * Storage bucket name. Created in the Supabase dashboard. The adapter
     * does not create or delete buckets.
     */
    bucket: string;

    /**
     * Pre-built `StorageClient` from `@supabase/storage-js`. Mutually
     * exclusive with `serviceKey` + `url`. Use this when you want to share
     * a `StorageClient` instance, customize `fetch`, or pass extra headers.
     */
    client?: StorageClient;

    /**
     * Override the global `fetch` (e.g. for tests, custom timeouts, retries).
     * Ignored when `client` is supplied.
     */
    fetch?: typeof globalThis.fetch;

    /**
     * Default expiry, in seconds, for `getReadUrl`. Capped at 1 week (Supabase
     * maximum). Defaults to 3600 (1 hour).
     */
    defaultUrlExpiresIn?: number;

    /**
     * Configure metafiles storage. Used for TUS-style resumable upload
     * bookkeeping. Defaults to {@link LocalMetaStorage} under the OS tmp
     * directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Supabase service-role key (or anon key with appropriate RLS).
     * Ignored when `client` is supplied. Falls back to `SUPABASE_SERVICE_ROLE_KEY`
     * or `SUPABASE_KEY`.
     */
    serviceKey?: string;

    /**
     * Supabase project URL (e.g. `https://abc.supabase.co`). The adapter
     * appends `/storage/v1` automatically. Ignored when `client` is supplied.
     * Falls back to `SUPABASE_URL`.
     */
    url?: string;
}
