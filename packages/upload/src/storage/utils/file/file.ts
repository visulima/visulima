import { nanoid } from "nanoid";

import { hash } from "../../../utils";
import extractMimeType from "./extract-mime-type";
import extractOriginalName from "./extract-original-name";
import { Metadata } from "./metadata";
import type { FileInit, UploadEventType } from "./types";

const generateFileId = (file: File): string => {
    const {
        originalName, size, metadata,
    } = file;
    const mtime = String(metadata.lastModified || Date.now());

    return [originalName, size, mtime]
        .filter(Boolean)
        .map(String)
        .map((value) => hash(value))
        .join("-");
};

class File implements FileInit {
    bytesWritten: number = Number.NaN;

    contentType: string;

    originalName: string;

    id: string;

    metadata: Metadata;

    name: string = "";

    size?: number;

    status?: UploadEventType;

    expiredAt?: string | Date | number;

    createdAt?: string | Date | number;

    modifiedAt?: string | Date | number;

    hash?: {
        algorithm: string;
        value: string;
    };

    content?: Buffer;

    ETag?: string;

    constructor({
        metadata = {}, originalName, contentType, size,
    }: FileInit) {
        this.metadata = metadata;
        this.originalName = originalName || extractOriginalName(metadata) || (this.id = nanoid());
        this.contentType = contentType || extractMimeType(metadata) || "application/octet-stream";

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
