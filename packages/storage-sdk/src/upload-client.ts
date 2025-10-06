import { MultipartClient } from "./multipart-client";
import { TusClient } from "./tus-client";
import type {
    UploadClientConfig,
    UploadOptions,
    Upload,
    UploadResult,
    UploadProgress,
    UploadError
} from "./types";

export class UploadClient {
    private tusClient: TusClient;
    private multipartClient: MultipartClient;
    private config: UploadClientConfig;

    constructor(config: UploadClientConfig) {
        this.config = config;
        this.tusClient = new TusClient(config);
        this.multipartClient = new MultipartClient(config);
    }

    /**
     * Upload a file using the best available method
     */
    async upload(options: UploadOptions): Promise<Upload> {
        const { protocol = "auto", file } = options;

        // Choose upload protocol
        if (protocol === "tus") {
            return this.uploadWithTus(options);
        } else if (protocol === "multipart") {
            return this.uploadWithMultipart(options);
        } else {
            // Auto mode - choose based on file size and server capabilities
            return this.uploadAuto(options);
        }
    }

    /**
     * Upload using Tus protocol
     */
    private async uploadWithTus(options: UploadOptions): Promise<Upload> {
        return this.tusClient.createUpload(options as any);
    }

    /**
     * Upload using multipart form data
     */
    private async uploadWithMultipart(options: UploadOptions): Promise<Upload> {
        // For multipart, we create a wrapper that behaves like an Upload
        const { file, onStart, onComplete, onError, onProgress } = options;

        const abortController = new AbortController();

        const upload: Upload = {
            id: this.generateId(),
            state: "pending",
            file,
            progress: {
                id: this.generateId(),
                loaded: 0,
                total: file.size,
                percentage: 0,
            },
            start: async () => {
                upload.state = "uploading";
                onStart?.(upload);

                try {
                    const result = await this.multipartClient.upload(options as any);

                    upload.state = "completed";
                    upload.result = result;
                    upload.progress.loaded = file.size;
                    upload.progress.percentage = 100;

                    onProgress?.(upload.progress);
                    onComplete?.(result);
                } catch (error) {
                    upload.state = "error";
                    const uploadError: UploadError = {
                        name: "UploadError",
                        message: error instanceof Error ? error.message : "Upload failed",
                        id: upload.id,
                        statusCode: (error as any)?.statusCode,
                    };
                    upload.error = uploadError;
                    onError?.(uploadError);
                }
            },
            pause: async () => {
                throw new Error("Multipart uploads cannot be paused");
            },
            cancel: async () => {
                abortController.abort();
                upload.state = "cancelled";
            },
            getUrl: () => null,
        };

        return upload;
    }

    /**
     * Automatically choose the best upload method
     */
    private async uploadAuto(options: UploadOptions): Promise<Upload> {
        const { file } = options;

        // For small files, use multipart (simpler)
        // For large files, try Tus if server supports it
        if (file.size < 10 * 1024 * 1024) { // 10MB
            return this.uploadWithMultipart(options);
        }

        // Try to check server capabilities for Tus
        try {
            const capabilities = await this.tusClient.getServerCapabilities();
            if (capabilities.extensions.includes("creation")) {
                return this.uploadWithTus(options);
            }
        } catch {
            // Server doesn't support Tus or is not available, fall back to multipart
        }

        return this.uploadWithMultipart(options);
    }

    /**
     * Resume an existing upload
     */
    async resumeUpload(uploadUrl: string, options: UploadOptions): Promise<Upload> {
        // Try Tus resume first
        try {
            return await this.tusClient.resumeUpload(uploadUrl, options as any);
        } catch {
            // If Tus resume fails, the upload might not be resumable
            throw new Error("Cannot resume upload: not a Tus upload or upload not found");
        }
    }

    /**
     * Delete an uploaded file
     */
    async delete(fileUrl: string): Promise<void> {
        // Try Tus delete first
        try {
            const response = await fetch(fileUrl, {
                method: "DELETE",
                headers: { "Tus-Resumable": "1.0.0" },
            });

            if (response.status === 204) {
                return;
            }
        } catch {
            // Fall back to regular delete
        }

        await this.multipartClient.delete(fileUrl);
    }

    /**
     * Get file metadata
     */
    async getMetadata(fileUrl: string): Promise<any> {
        return this.multipartClient.getMetadata(fileUrl);
    }

    /**
     * Get server capabilities
     */
    async getServerCapabilities(): Promise<{
        tus?: {
            version: string;
            extensions: string[];
            maxSize?: number;
            checksumAlgorithms: string[];
        };
        multipart?: {
            maxFileSize: number;
        };
    }> {
        const capabilities: any = {};

        try {
            capabilities.tus = await this.tusClient.getServerCapabilities();
        } catch {
            // Tus not supported
        }

        capabilities.multipart = {
            maxFileSize: 100 * 1024 * 1024, // Default max file size
        };

        return capabilities;
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}
