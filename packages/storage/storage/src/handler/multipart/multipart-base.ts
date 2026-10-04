import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import type { ResponseFile } from "../types";
import { withoutInternalKeys } from "../utils/request-parser";

/**
 * Base class containing shared Multipart business logic.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
abstract class MultipartBase<TFile extends UploadFile> {
    /**
     * Handle multipart POST (upload file).
     * @param filePart File part from multipart parser
     * @param filePart.bytes File bytes data
     * @param filePart.filename Original filename
     * @param filePart.mediaType Content type
     * @param filePart.size File size in bytes
     * @param metadataParts All parts from multipart parser (for extracting metadata)
     * @param requestUrl Request URL for Location header
     * @returns Promise resolving to ResponseFile with upload result
     */

    public async handlePost(
        filePart: { bytes: unknown; filename?: string; mediaType?: string; size: number },
        metadataParts: { isFile: boolean; name?: string; text?: string }[],
        requestUrl: string,
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

        // Create a stream from the bytes data
        const stream = this.createStreamFromBytes(filePart.bytes);

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

        const locationUrl = this.buildFileUrl(requestUrl, finalFile);

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
        const file = await this.storage.delete({ id });

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 };
    }

    /**
     * Storage instance for file operations.
     */
    // eslint-disable-next-line class-methods-use-this
    protected get storage(): {
        create: (config: FileInit) => Promise<TFile>;
        delete: (options: { id: string }) => Promise<TFile>;
        maxUploadSize: number;
        write: (options: { body: unknown; contentLength: number; id: string; start: number }) => Promise<TFile>;
    } {
        // This will be overridden by subclasses
        throw new Error("storage must be implemented");
    }

    /**
     * Maximum file size allowed for multipart uploads
     */
    protected abstract get maxFileSize(): number;

    /**
     * Maximum header size allowed for multipart parser
     */
    protected abstract get maxHeaderSize(): number;

    /**
     * Build file URL from request URL and file data.
     * @param _requestUrl Request URL string
     * @param _file File object containing ID and content type
     * @returns Constructed file URL with extension based on content type
     */
    // eslint-disable-next-line class-methods-use-this
    protected buildFileUrl(_requestUrl: string, _file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }

    /**
     * Create a stream from bytes data.
     * @param bytes Bytes data (Uint8Array, Buffer, or other)
     * @returns Stream object
     */
    protected abstract createStreamFromBytes(bytes: unknown): unknown;

    /**
     * Create an empty stream for signaling completion.
     * @returns Empty stream object
     */
    protected abstract createEmptyStream(): unknown;
}

export default MultipartBase;
