import type { AccessOptions } from "basic-ftp";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface FtpStorageOptions extends BaseStorageOptions {
    /**
     * `basic-ftp` access options (`host`, `port`, `user`, `password`,
     * `secure` for FTPS, …). A fresh connection is opened and closed around
     * every storage operation — an FTP control connection is single-session,
     * so the adapter does not pool connections.
     */
    connection: AccessOptions;

    /**
     * Configure metafile storage. FTP has no native arbitrary-metadata
     * field, so upload metadata is stored as sidecar JSON on the local
     * disk (defaults to the OS temp directory).
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Logical "bucket root" — virtual keys live under this remote directory.
     * A leading `/` makes it absolute; otherwise it resolves against the
     * login directory. Trailing slashes are ignored. The adapter creates
     * intermediate directories on write. Defaults to the login directory.
     */
    rootFolderPath?: string;
}
