import type { ConnectOptions } from "ssh2-sftp-client";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface SftpStorageOptions extends BaseStorageOptions {
    /**
     * ssh2-sftp-client connection options (`host`, `port`, `username`,
     * `password`, `privateKey`, `passphrase`, …). A fresh connection is
     * opened and closed around every storage operation — the underlying
     * SSH channel is not safe for concurrent use, so the adapter does not
     * pool connections.
     */
    connection: ConnectOptions;

    /**
     * Configure metafile storage. SFTP has no native arbitrary-metadata
     * field, so upload metadata is stored as sidecar JSON on the local
     * disk (defaults to the OS temp directory).
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Logical "bucket root" — virtual keys live under this remote directory.
     * The adapter creates intermediate directories on write. A leading slash
     * makes it absolute; otherwise it resolves against the connection's home
     * directory (the default). Trailing slashes are ignored.
     */
    rootFolderPath?: string;
}
