import type { Readable } from "node:stream";

import type { Metadata } from "./metadata";

export interface FileInit {
    contentType?: string;
    expiredAt?: Date | number | string;

    /**
     * Explicit identifier. When provided, the File constructor uses it directly
     * instead of deriving an id from originalName/size/mtime. Lets callers map a
     * user-chosen storage key (e.g. `"avatars/abc.png"`) onto the metadata id.
     */
    id?: string;
    metadata: Metadata;
    originalName?: string;
    size?: number | string;
    storageClass?: string;
    ttl?: number | string;
}

export interface FileReturn extends Omit<Required<FileInit>, "id" | "storageClass" | "ttl" | "expiredAt"> {
    content: Buffer;

    ETag?: string;

    expiredAt?: Date | number | string;

    id: string;

    modifiedAt?: Date | number | string;

    name: string;

    storageClass?: string;
}

type UploadEventTypeValue = "completed" | "created" | "deleted" | "part" | "updated";

export type UploadEventType = UploadEventTypeValue;

export interface FileQuery {
    id: string;
    name?: string;
    size?: number;
}

export interface Checksum {
    checksum?: string;
    checksumAlgorithm?: string;
}

export interface FilePart extends Checksum, FileQuery {
    body: Readable;
    contentLength?: number;
    start: number;
}
