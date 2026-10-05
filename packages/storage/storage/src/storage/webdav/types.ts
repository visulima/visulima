import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface WebdavStorageOptions extends BaseStorageOptions {
    /**
     * Send the `Files` ETag predicates to the server (`If-Match` / `If-None-Match` on `PUT`, `GET`
     * and `DELETE`; `If-Match`, `Overwrite: F` and a tagged `If` header on `COPY`) and advertise them
     * in `Files.capabilities.conditional`. Off by default: RFC 4918 servers (Nextcloud, ownCloud,
     * Apache `mod_dav`) evaluate them, but some WebDAV servers silently ignore them, which would turn
     * a compare-and-set into an unconditional write. Reported ETags are the server's when this is on.
     */
    conditional?: boolean;

    /**
     * Extra headers sent with every request (e.g. a custom auth scheme).
     */
    headers?: Record<string, string>;

    /**
     * Configure metafile storage. WebDAV has no portable arbitrary-metadata
     * field, so upload metadata is stored as sidecar JSON on the local disk
     * (defaults to the OS temp directory).
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Password for HTTP Basic auth. Falls back to `WEBDAV_PASSWORD`.
     */
    password?: string;

    /**
     * Logical "bucket root" — virtual keys live under this collection, relative
     * to `url`. Missing collections are created on write. Leading/trailing
     * slashes are ignored.
     */
    rootFolderPath?: string;

    /**
     * Bearer token, sent in an `Authorization: Bearer` header. Takes precedence
     * over `username` / `password`. Falls back to `WEBDAV_TOKEN`.
     */
    token?: string;

    /**
     * WebDAV endpoint, e.g. `https://cloud.example.com/remote.php/dav/files/alice`.
     * Falls back to `WEBDAV_URL`.
     */
    url?: string;

    /**
     * Username for HTTP Basic auth. Falls back to `WEBDAV_USERNAME`.
     */
    username?: string;
}
