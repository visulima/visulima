import createHttpError from "http-errors";

import type { FileInit, UploadFile } from "../../storage/utils/file";
import type { ResponseFile } from "../types";

/**
 * Base class containing shared Multipart business logic.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
abstract class MultipartBase<TFile extends UploadFile> {
    /**
     * Storage instance for file operations.
     */
    protected get storage(): {
        create: (config: FileInit) => Promise<TFile>;
        delete: (options: { id: string }) => Promise<TFile>;
        maxUploadSize: number;
        update: (options: { id: string }, updates: { metadata?: Record<string, unknown> }) => Promise<TFile>;
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
    protected buildFileUrl(_requestUrl: string, _file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }

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
    protected async handlePost(
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
                        data = JSON.parse(part.text);
                    } catch {
                        // ignore
                    }
                } else if (part.name) {
                    data = { [part.name]: part.text };
                }

                Object.assign(config.metadata, data);
            }
        }

        const file = await this.storage.create(config);

        // Create a stream from the bytes data
        const stream = this.createStreamFromBytes(filePart.bytes);

        await this.storage.write({
            body: stream,
            contentLength: filePart.size,
            id: file.id,
            start: 0,
        });

        // Wait for the file to be completed
        const completedFile = await this.storage.write({
            body: this.createEmptyStream(),
            contentLength: 0,
            id: file.id,
            start: filePart.size,
        });

        // Update completed file with metadata if any was provided
        let finalFile = completedFile;

        if (Object.keys(config.metadata).length > 0) {
            const mergedMetadata = {
                ...completedFile.metadata,
                ...config.metadata,
            };
            const updatedFile = await this.storage.update({ id: completedFile.id }, { metadata: mergedMetadata });

            finalFile = { ...updatedFile, status: completedFile.status };
        }

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
    protected async handleDelete(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.delete({ id });

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 } as ResponseFile<TFile>;
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
