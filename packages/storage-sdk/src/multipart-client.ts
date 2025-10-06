import { HttpClient } from "./http-client";
import type {
    MultipartClientConfig,
    MultipartUploadOptions,
    Upload,
    UploadError,
    UploadProgress,
    UploadResult
} from "./types";
import { getFileName } from "./types";

interface MultipartUpload extends Upload {
    /** Abort controller for cancelling the upload */
    abortController: AbortController;
}

export class MultipartClient {
    private http: HttpClient;
    private config: Required<MultipartClientConfig>;

    constructor(config: MultipartClientConfig) {
        this.config = {
            baseUrl: config.baseUrl,
            headers: config.headers || {},
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000,
            chunkSize: config.chunkSize || 1024 * 1024, // 1MB (not used for multipart)
            maxConcurrent: config.maxConcurrent || 3,
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
        };

        this.http = new HttpClient(this.config);
    }

    /**
     * Upload a file using multipart/form-data
     */
    async upload(options: MultipartUploadOptions): Promise<UploadResult> {
        const { file, endpoint = "/upload", metadata = {}, fieldName = "file", formData: additionalFormData = {}, onProgress, onStart, onComplete, onError } = options;

        // Check file size
        if (file.size > this.config.maxFileSize) {
            throw new Error(`File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`);
        }

        // Create FormData
        const formData = new FormData();

        // Add the file
        formData.append(fieldName, file, getFileName(file));

        // Add metadata
        if (Object.keys(metadata).length > 0) {
            formData.append("metadata", JSON.stringify(metadata));
        }

        // Add additional form data
        for (const [key, value] of Object.entries(additionalFormData)) {
            if (value instanceof Blob) {
                formData.append(key, value);
            } else {
                formData.append(key, String(value));
            }
        }

        const abortController = new AbortController();

        const upload: MultipartUpload = {
            id: this.generateId(),
            state: "uploading",
            file,
            abortController,
            progress: {
                id: this.generateId(),
                loaded: 0,
                total: file.size,
                percentage: 0,
            },
            start: async () => {
                // Multipart uploads start immediately
                throw new Error("Upload already started");
            },
            pause: async () => {
                throw new Error("Multipart uploads cannot be paused");
            },
            cancel: async () => {
                abortController.abort();
            },
            getUrl: () => null,
        };

        onStart?.(upload);

        try {
            const response = await this.http.post(endpoint, {
                headers: {
                    // Let the browser set Content-Type with boundary
                    ...this.config.headers,
                },
                body: formData,
                signal: abortController.signal,
            });

            if (response.status !== 200) {
                const errorText = await this.http.readAsText(response);
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            // Try to parse JSON response
            let resultData: any;
            try {
                resultData = await this.http.readAsJson(response);
            } catch {
                // If response is not JSON, create a basic result
                resultData = {
                    id: upload.id,
                    url: response.headers.location || `${this.config.baseUrl}${endpoint}`,
                };
            }

            const result: UploadResult = {
                id: resultData.id || upload.id,
                url: resultData.url || resultData.location || `${this.config.baseUrl}${endpoint}`,
                metadata: {
                    name: getFileName(file),
                    type: file.type,
                    size: file.size,
                    ...metadata,
                },
                size: file.size,
            };

            upload.state = "completed";
            upload.result = result;

            // Update progress to 100%
            upload.progress.loaded = file.size;
            upload.progress.percentage = 100;
            onProgress?.(upload.progress);

            onComplete?.(result);
            return result;

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
            throw uploadError;
        }
    }

    /**
     * Generate a unique upload ID
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Delete an uploaded file
     */
    async delete(fileUrl: string): Promise<void> {
        const response = await this.http.delete(fileUrl);

        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Failed to delete file: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Get file metadata
     */
    async getMetadata(fileUrl: string): Promise<any> {
        const metadataUrl = `${fileUrl}/metadata`;
        const response = await this.http.get(metadataUrl);

        if (response.status !== 200) {
            throw new Error(`Failed to get metadata: ${response.status} ${response.statusText}`);
        }

        return this.http.readAsJson(response);
    }
}
