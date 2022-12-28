import { isRecord } from "../../../utils";

export class Metadata {
    [key: string]: any;

    size?: string | number;

    name?: string;

    filetype?: string;

    type?: string;

    mimeType?: string;

    contentType?: string;

    title?: string;

    filename?: string;

    originalName?: string;

    lastModified?: string | number;
}

export function isMetadata(raw: unknown): raw is Metadata {
    return isRecord(raw);
}
