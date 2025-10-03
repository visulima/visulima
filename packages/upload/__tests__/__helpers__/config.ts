import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import type { BaseStorageOptions } from "../../src/storage/types";
import type { File } from "../../src/storage/utils/file";
import { hash } from "./utils";

async function* generateChunks(): AsyncIterableIterator<string> {
    yield "xz".repeat(16);
    yield "xz".repeat(16);
}

const id = "e8fed598250d10ea-7f59007b4b7cf67-120941ca7dc37b78";
const contentType = "video/mp4";
const fileAsBuffer = Buffer.from("xz".repeat(32));
const size = Buffer.byteLength(fileAsBuffer);
const fileAsReadStream = Readable.from(generateChunks());
const sha1 = hash(fileAsBuffer, "sha1");

export const testRoot = join(tmpdir(), "files");

export const storageOptions: BaseStorageOptions<File> = {
    allowMIME: ["video/*", "image/*", "application/octet-stream"],
    expiration: { maxAge: "1h" },
    filename: (file) => `${"anonymous"}/${file.originalName}`,
    maxUploadSize: "6GB",
    useRelativeLocation: true,
};

export const metadata = {
    custom: "",
    lastModified: 1_635_398_061_454,
    mimeType: "video/mp4",
    // eslint-disable-next-line radar/no-duplicate-string
    name: "testfile.mp4",
    sha1,
    size,
};

export const testfile = {
    ...metadata,
    asBuffer: fileAsBuffer,
    asReadable: fileAsReadStream,
    contentType: metadata.mimeType,
    filename: metadata.name,
    metafilename: `${id}.META`,
};

export const metafile = {
    bytesWritten: null as number | null,
    contentType,
    id,
    metadata,
    name: "testfile.mp4",
    originalName: "testfile.mp4",
    size,
} as File;
