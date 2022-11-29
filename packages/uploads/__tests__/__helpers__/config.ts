import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import type { BaseStorageOptions } from "../../src/storage/types.d";
import { File } from "../../src/storage/utils/file";
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
    filename: (file) => `${"anonymous"}/${file.originalName}`,
    maxUploadSize: "6GB",
    allowMIME: ["video/*", "image/*", "application/octet-stream"],
    useRelativeLocation: true,
    expiration: { maxAge: "1h" },
};

export const metadata = {
    // eslint-disable-next-line radar/no-duplicate-string
    name: "testfile.mp4",
    size,
    mimeType: "video/mp4",
    lastModified: 1_635_398_061_454,
    custom: "",
    sha1,
};

export const testfile = {
    ...metadata,
    filename: metadata.name,
    metafilename: `${id}.META`,
    asBuffer: fileAsBuffer,
    asReadable: fileAsReadStream,
    contentType: metadata.mimeType,
};

export const metafile = {
    bytesWritten: null as number | null,
    name: "testfile.mp4",
    metadata,
    originalName: "testfile.mp4",
    contentType,
    size,
    id,
} as File;
