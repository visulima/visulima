import { Readable } from "node:stream";

import createHttpError from "http-errors";

import type { BaseStorage } from "../../storage/storage";
import type { FileInit, UploadFile } from "../../storage/utils/file";
import type { LocationSource } from "../base/base-handler-core";
import type { ResponseFile } from "../types";
import { withoutInternalKeys } from "../utils/request-parser";

/**
 * The part of a storage adapter the multipart handler uses.
 */
export type MultipartStorage<TFile extends UploadFile> = Pick<BaseStorage<TFile>, "create" | "deleteUpload" | "write">;

export interface MultipartBaseConfig<TFile extends UploadFile> {
    /** Builds the `Location` of a file from the request that uploaded it. */
    buildFileUrl: (request: LocationSource, file: TFile) => string;

    /** The storage adapter. */
    storage: () => MultipartStorage<TFile>;
}

/**
 * Shared multipart logic for the Node.js and Web (fetch) handlers.
 * @template TFile The file type used by this handler.
 */
class MultipartBase<TFile extends UploadFile> {
    public constructor(private readonly config: MultipartBaseConfig<TFile>) {}

    private get storage(): MultipartStorage<TFile> {
        return this.config.storage();
    }

    /**
     * Handle multipart POST (upload file).
     * @param filePart File part from multipart parser
     * @param filePart.bytes File bytes data
     * @param filePart.filename Original filename
     * @param filePart.mediaType Content type
     * @param filePart.size File size in bytes
     * @param metadataParts All parts from multipart parser (for extracting metadata)
     * @param request Request the Location header is built from
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async handlePost(
        filePart: { bytes: Uint8Array; filename?: string; mediaType?: string; size: number },
        metadataParts: { isFile: boolean; name?: string; text?: string }[],
        request: LocationSource,
    ): Promise<ResponseFile<TFile>> {
        const config: FileInit = {
            contentType: filePart.mediaType || "application/octet-stream",
            metadata: {},
            originalName: filePart.filename,
            size: filePart.size,
        };

        // Process metadata parts
        for (const part of metadataParts) {
            if (!part.isFile && part.name) {
                let data = {};

                if (part.name === "metadata" && part.text) {
                    try {
                        data = JSON.parse(part.text) as Record<string, unknown>;
                    } catch {
                        // ignore
                    }
                } else if (part.name) {
                    data = { [part.name]: part.text };
                }

                Object.assign(config.metadata, withoutInternalKeys(data));
            }
        }

        const file = await this.storage.create(config);

        const stream = Readable.from(Buffer.from(filePart.bytes));

        // Multipart uploads ship the full body in a single request, so a single write covers the
        // entire payload. The adapter's `write` flips `status` to `completed` automatically when
        // `bytesWritten >= size`. Issuing a follow-up zero-byte write was fragile: some adapters
        // reset `bytesWritten` to 0 on a content-less write, others ignored it entirely.
        const completedFile = await this.storage.write({
            body: stream,
            contentLength: filePart.size,
            id: file.id,
            start: 0,
        });

        // The form fields were stored by `create`. No metadata update follows: it would derive
        // originalName from fields like `title` or `name`, while the file part's filename wins.
        const finalFile = completedFile;

        const locationUrl = this.config.buildFileUrl(request, finalFile);

        return {
            ...finalFile,
            headers: {
                Location: locationUrl,
                ...(finalFile.expiredAt === undefined ? {} : { "X-Upload-Expires": finalFile.expiredAt.toString() }),
                ...(finalFile.ETag === undefined ? {} : { ETag: finalFile.ETag }),
            },
            statusCode: 200,
        };
    }

    /**
     * Handle DELETE (delete file).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with deletion result
     */
    public async handleDelete(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.deleteUpload(id);

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 };
    }
}

export default MultipartBase;
