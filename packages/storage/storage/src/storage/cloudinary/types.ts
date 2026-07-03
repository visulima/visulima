import type { v2 as cloudinary } from "cloudinary";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface CloudinaryStorageOptions extends BaseStorageOptions {
    /**
     * Cloudinary API key. Ignored when `client` is supplied. Falls back to
     * `CLOUDINARY_API_KEY`, or the credentials encoded in `CLOUDINARY_URL`.
     */
    apiKey?: string;

    /**
     * Cloudinary API secret. Ignored when `client` is supplied. Falls back to
     * `CLOUDINARY_API_SECRET`, or the credentials encoded in `CLOUDINARY_URL`.
     */
    apiSecret?: string;

    /**
     * Pre-configured `cloudinary` namespace (the `v2` export). Mutually
     * exclusive with `cloudName` + `apiKey` + `apiSecret`. When supplied the
     * adapter skips `cloudinary.config()` and uses the instance as-is.
     */
    client?: typeof cloudinary;

    /**
     * Cloudinary cloud name. Ignored when `client` is supplied. Falls back to
     * `CLOUDINARY_CLOUD_NAME`, or the host segment of `CLOUDINARY_URL`.
     */
    cloudName?: string;

    /**
     * Default expiry, in seconds, for `getReadUrl` signed URLs on private or
     * authenticated assets. Defaults to 3600 (1 hour).
     */
    defaultUrlExpiresIn?: number;

    /**
     * Configure metafiles storage. Used for TUS-style resumable upload
     * bookkeeping. Defaults to {@link LocalMetaStorage} under the OS tmp
     * directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Cloudinary resource type. Use `"raw"` for arbitrary files, `"image"` or
     * `"video"` for media that benefits from transformations. Defaults to
     * `"raw"`.
     */
    resourceType?: "image" | "raw" | "video";

    /**
     * Generate `https://` delivery URLs. Defaults to `true`.
     */
    secure?: boolean;

    /**
     * Cloudinary delivery type. `"private"` and `"authenticated"` require a
     * signed URL for delivery. Defaults to `"upload"`.
     */
    type?: "authenticated" | "private" | "upload";
}
