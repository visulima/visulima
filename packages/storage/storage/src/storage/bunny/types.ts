import type * as BunnyStorageSDK from "@bunny.net/storage-sdk";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

/**
 * Bunny Storage region code. Mirrors the SDK's `StorageRegion` enum values
 * (e.g. `"de"`, `"ny"`, `"syd"`).
 */
export type BunnyStorageRegion = `${BunnyStorageSDK.regions.StorageRegion}`;

/**
 * A connected Bunny Storage zone produced by
 * `BunnyStorageSDK.zone.connect_with_accesskey(...)`.
 */
export type BunnyStorageClient = ReturnType<typeof BunnyStorageSDK.zone.connect_with_accesskey>;

export interface BunnyStorageOptions extends BaseStorageOptions {
    /**
     * Bunny Storage zone password / API access key. Falls back to
     * `BUNNY_STORAGE_ACCESS_KEY`, then `BUNNY_ACCESS_KEY`, then the
     * SDK-documented `STORAGE_ACCESS_KEY`. Ignored when `client` is supplied.
     */
    accessKey?: string;

    /**
     * Pre-built `StorageZone` instance. Use this to share an instance across
     * adapters or inject test stubs. Mutually exclusive with `zone` /
     * `accessKey` / `region`.
     */
    client?: BunnyStorageClient;

    /**
     * Configure metafiles storage for resumable-upload bookkeeping.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Origin used to build URLs from `getReadUrl`, typically a Bunny Pull
     * Zone or custom CDN hostname in front of the Storage Zone. When unset,
     * `getReadUrl` throws because the Storage API requires an `AccessKey`
     * header and has no signed-read URL primitive.
     */
    publicBaseUrl?: string;

    /**
     * Primary Bunny Storage region. Pass one of
     * `BunnyStorageSDK.regions.StorageRegion.*`, e.g. `"de"`, `"ny"`, `"syd"`.
     * Falls back to `BUNNY_STORAGE_REGION`, then `STORAGE_REGION`. Ignored
     * when `client` is supplied.
     */
    region?: BunnyStorageRegion;

    /**
     * Bunny Storage zone name. Falls back to `BUNNY_STORAGE_ZONE`, then the
     * SDK-documented `STORAGE_ZONE`. Ignored when `client` is supplied.
     */
    zone?: string;
}
