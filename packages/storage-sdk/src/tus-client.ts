import { HttpClient } from "./http-client";
import type {
    FileMetadata,
    TusClientConfig,
    TusUploadOptions,
    Upload,
    UploadError,
    UploadProgress,
    UploadResult
} from "./types";
import { getFileName } from "./types";

const TUS_RESUMABLE = "1.0.0";

interface TusUpload extends Upload {
    /** Tus upload URL */
    url: string | null;
    /** Upload offset */
    offset: number;
}

export class TusClient {
    private http: HttpClient;
    private config: Required<TusClientConfig>;

    constructor(config: TusClientConfig) {
        this.config = {
            baseUrl: config.baseUrl,
            headers: {
                "Tus-Resumable": TUS_RESUMABLE,
                ...config.headers,
            },
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000,
            chunkSize: config.chunkSize || 1024 * 1024, // 1MB
            maxConcurrent: config.maxConcurrent || 3,
            version: config.version || "1.0.0",
            extensions: config.extensions || ["creation", "creation-with-upload", "termination", "checksum", "creation-defer-length", "expiration"],
            checksumAlgorithms: config.checksumAlgorithms || ["md5", "sha1"],
        };

        this.http = new HttpClient(this.config);
    }

    /**
     * Create a new Tus upload
     */
    async createUpload(options: TusUploadOptions): Promise<TusUpload> {
        const { file, endpoint = "/files", metadata = {}, onStart } = options;

        // Prepare metadata for Tus protocol
        const tusMetadata: Record<string, string> = {};

        if (metadata.name || getFileName(file)) {
            tusMetadata.filename = metadata.name || getFileName(file);
        }

        if (metadata.type || file.type) {
            tusMetadata.filetype = metadata.type || file.type;
        }

        // Add custom metadata
        for (const [key, value] of Object.entries(metadata)) {
            if (key !== "name" && key !== "type" && key !== "size") {
                tusMetadata[key] = String(value);
            }
        }

        // Serialize metadata
        const metadataHeader = Object.entries(tusMetadata)
            .map(([key, value]) => `${key} ${Buffer.from(value).toString("base64")}`)
            .join(",");

        const uploadLength = file.size;

        // Create the upload resource
        const response = await this.http.post(endpoint, {
            headers: {
                "Upload-Length": uploadLength.toString(),
                "Upload-Metadata": metadataHeader,
                "Content-Type": "application/offset+octet-stream",
            },
        });

        if (response.status !== 201) {
            throw new Error(`Failed to create upload: ${response.status} ${response.statusText}`);
        }

        const uploadUrl = response.headers.location;
        if (!uploadUrl) {
            throw new Error("No upload URL received from server");
        }

        const tusUpload: TusUpload = {
            id: this.extractIdFromUrl(uploadUrl),
            state: "pending",
            file,
            url: uploadUrl,
            offset: 0,
            progress: {
                id: this.extractIdFromUrl(uploadUrl),
                loaded: 0,
                total: file.size,
                percentage: 0,
            },
            start: async () => {
                await this.startUpload(tusUpload, options);
            },
            pause: async () => {
                tusUpload.state = "paused";
            },
            cancel: async () => {
                await this.cancelUpload(tusUpload);
            },
            getUrl: () => tusUpload.url,
        };

        onStart?.(tusUpload);
        return tusUpload;
    }

    /**
     * Resume an existing Tus upload
     */
    async resumeUpload(uploadUrl: string, options: TusUploadOptions): Promise<TusUpload> {
        const { file, onStart } = options;

        // Get current upload status
        const headResponse = await this.http.head(uploadUrl);

        if (headResponse.status !== 200) {
            throw new Error(`Failed to get upload status: ${headResponse.status} ${headResponse.statusText}`);
        }

        const uploadOffset = parseInt(headResponse.headers["upload-offset"] || "0", 10);
        const uploadLength = parseInt(headResponse.headers["upload-length"] || file.size.toString(), 10);

        const tusUpload: TusUpload = {
            id: this.extractIdFromUrl(uploadUrl),
            state: "paused",
            file,
            url: uploadUrl,
            offset: uploadOffset,
            progress: {
                id: this.extractIdFromUrl(uploadUrl),
                loaded: uploadOffset,
                total: uploadLength,
                percentage: Math.round((uploadOffset / uploadLength) * 100),
            },
            start: async () => {
                await this.startUpload(tusUpload, options);
            },
            pause: async () => {
                tusUpload.state = "paused";
            },
            cancel: async () => {
                await this.cancelUpload(tusUpload);
            },
            getUrl: () => tusUpload.url,
        };

        onStart?.(tusUpload);
        return tusUpload;
    }

    /**
     * Start or resume uploading
     */
    private async startUpload(tusUpload: TusUpload, options: TusUploadOptions): Promise<void> {
        const { onProgress, onComplete, onError } = options;

        tusUpload.state = "uploading";
        const startTime = Date.now();

        try {
            while (tusUpload.offset < tusUpload.file.size && tusUpload.state === "uploading") {
                const chunkSize = Math.min(this.config.chunkSize, tusUpload.file.size - tusUpload.offset);
                const chunk = tusUpload.file.slice(tusUpload.offset, tusUpload.offset + chunkSize);

                const response = await this.http.patch(tusUpload.url!, {
                    headers: {
                        "Content-Type": "application/offset+octet-stream",
                        "Upload-Offset": tusUpload.offset.toString(),
                        "Content-Length": chunkSize.toString(),
                    },
                    body: chunk,
                });

                if (response.status !== 204) {
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
                }

                tusUpload.offset += chunkSize;
                tusUpload.progress.loaded = tusUpload.offset;
                tusUpload.progress.percentage = Math.round((tusUpload.offset / tusUpload.file.size) * 100);

                // Calculate speed and ETA
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) {
                    tusUpload.progress.speed = Math.round(tusUpload.offset / elapsed);
                    const remaining = tusUpload.file.size - tusUpload.offset;
                    tusUpload.progress.eta = remaining / tusUpload.progress.speed!;
                }

                onProgress?.(tusUpload.progress);

                // Allow other operations to run
                await new Promise(resolve => setImmediate ? setImmediate(resolve) : setTimeout(resolve, 0));
            }

            if (tusUpload.state === "uploading") {
                tusUpload.state = "completed";

                const result: UploadResult = {
                    id: tusUpload.id,
                    url: tusUpload.url!,
                    metadata: {
                        name: getFileName(tusUpload.file),
                        type: tusUpload.file.type,
                        size: tusUpload.file.size,
                    },
                    size: tusUpload.file.size,
                };

                tusUpload.result = result;
                onComplete?.(result);
            }
        } catch (error) {
            tusUpload.state = "error";
            const uploadError: UploadError = {
                name: "UploadError",
                message: error instanceof Error ? error.message : "Upload failed",
                id: tusUpload.id,
                statusCode: (error as any)?.statusCode,
            };
            tusUpload.error = uploadError;
            onError?.(uploadError);
        }
    }

    /**
     * Cancel an upload
     */
    private async cancelUpload(tusUpload: TusUpload): Promise<void> {
        if (tusUpload.url) {
            try {
                await this.http.delete(tusUpload.url);
            } catch (error) {
                // Ignore errors when cancelling
            }
        }
        tusUpload.state = "cancelled";
    }

    /**
     * Extract upload ID from URL
     */
    private extractIdFromUrl(url: string): string {
        const urlParts = url.split("/");
        return urlParts[urlParts.length - 1] || url;
    }

    /**
     * Get server capabilities
     */
    async getServerCapabilities(endpoint = "/files"): Promise<{
        version: string;
        extensions: string[];
        maxSize?: number;
        checksumAlgorithms: string[];
    }> {
        const response = await this.http.options(endpoint);

        if (response.status !== 204) {
            throw new Error(`Failed to get server capabilities: ${response.status} ${response.statusText}`);
        }

        return {
            version: response.headers["tus-version"] || "1.0.0",
            extensions: response.headers["tus-extension"]?.split(",") || [],
            maxSize: response.headers["tus-max-size"] ? parseInt(response.headers["tus-max-size"], 10) : undefined,
            checksumAlgorithms: response.headers["tus-checksum-algorithm"]?.split(",") || [],
        };
    }
}
