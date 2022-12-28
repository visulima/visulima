import { Readable } from "node:stream";

import { Metadata } from "./metadata";

export interface FileInit {
    contentType?: string;
    originalName?: string;
    metadata: Metadata;
    size?: number | string;
}

export type UploadEventType = "created" | "completed" | "deleted" | "part" | "updated";

export interface FileQuery {
    id: string;
    name?: string;
    size?: number;
}

export type Checksum = {
    checksum?: string;
    checksumAlgorithm?: string;
};

export interface FilePart extends Checksum, FileQuery {
    body: Readable;
    contentLength?: number;
    start: number;
}
