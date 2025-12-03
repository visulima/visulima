import fnv1a from "@sindresorhus/fnv1a";
import { nanoid } from "nanoid";

import type { Metadata } from "./metadata";
import type { FileInit, UploadEventType } from "./types";

type DateType = Date | number | string;

const hash = (value: string) => fnv1a(value, { size: 64 }).toString(16);

/**
 * Extracts the MIME type from metadata object, checking multiple possible keys.
 */
const extractMimeType = (meta: Metadata): string | undefined => {
    if (typeof meta.mimeType === "string") {
        return meta.mimeType;
    }

    if (typeof meta.type === "string") {
        return meta.type;
    }

    if (typeof meta.filetype === "string") {
        return meta.filetype;
    }

    return undefined;
};

/**
 * Extracts the original filename from metadata object, checking multiple possible keys.
 */
const extractOriginalName = (meta: Metadata): string | undefined => {
    if (typeof meta.name === "string") {
        return meta.name;
    }

    if (typeof meta.title === "string") {
        return meta.title;
    }

    if (typeof meta.originalName === "string") {
        return meta.originalName;
    }

    if (typeof meta.filename === "string") {
        return meta.filename;
    }

    return undefined;
};

const generateFileId = (file: File): string => {
    const { metadata, originalName, size } = file;
    const mtime = String(metadata.lastModified ?? Date.now());

    return [originalName, size, mtime]
        .filter(Boolean)
        .map(String)
        .map((value) => hash(value))
        .join("-");
};

class File implements FileInit {
    public bytesWritten: number = Number.NaN;

    public contentType: string;

    public originalName: string;

    public id: string;

    public metadata: Metadata;

    public name = "";

    public size?: number;

    public status?: UploadEventType;

    public expiredAt?: DateType;

    public createdAt?: DateType;

    public modifiedAt?: DateType;

    public hash?: {
        algorithm: string;
        value: string;
    };

    public content?: Buffer;

    public ETag?: string;

    public constructor({ contentType, expiredAt, metadata = {}, originalName, size }: FileInit) {
        this.metadata = metadata;
        this.originalName = originalName || extractOriginalName(metadata) || (this.id = nanoid());
        this.contentType = contentType || extractMimeType(metadata) || "application/octet-stream";
        this.expiredAt = expiredAt;

        if (typeof size === "string" || typeof size === "number") {
            this.size = Number(size);
        } else if (typeof metadata.size === "string" || typeof metadata.size === "number") {
            this.size = Number(metadata.size);
        }

        if (typeof this.size === "number" && this.size <= 0) {
            this.size = undefined;
        }

        this.id ||= generateFileId(this);
    }
}

export type UploadFile = Readonly<File>;

export default File;
