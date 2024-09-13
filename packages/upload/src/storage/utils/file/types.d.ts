import type { Readable } from "node:stream";

import type { Metadata } from "./metadata";

export interface FileInit {
    contentType?: string;
    metadata: Metadata;
    originalName?: string;
    size?: number | string;
}

export interface FileReturn extends Required<FileInit> {
    ETag?: string;

    content: Buffer;

    expiredAt?: Date | number | string;

    id: string;

    modifiedAt?: Date | number | string;

    name: string;
}

export type UploadEventType = "completed" | "created" | "deleted" | "part" | "updated";

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
