export interface UploadClientConfig {
    /** Base URL of the upload server */
    baseUrl: string;
    /** HTTP headers to include in all requests */
    headers?: Record<string, string>;
    /** Timeout for requests in milliseconds */
    timeout?: number;
    /** Number of retry attempts for failed requests */
    retries?: number;
    /** Delay between retries in milliseconds */
    retryDelay?: number;
    /** Chunk size for resumable uploads in bytes */
    chunkSize?: number;
    /** Maximum concurrent uploads */
    maxConcurrent?: number;
}

export interface FileMetadata {
    /** Original filename */
    name?: string;
    /** MIME type */
    type?: string;
    /** File size in bytes */
    size?: number;
    /** Last modified timestamp */
    lastModified?: number;
    /** Custom metadata */
    [key: string]: any;
}

export interface UploadOptions {
    /** File to upload */
    file: File | Blob;
    /** Upload endpoint path (relative to baseUrl) */
    endpoint?: string;
    /** Custom metadata to send with the upload */
    metadata?: FileMetadata;
    /** Upload protocol to use */
    protocol?: "tus" | "multipart" | "auto";
    /** Callback for upload progress */
    onProgress?: (progress: UploadProgress) => void;
    /** Callback for upload completion */
    onComplete?: (result: UploadResult) => void;
    /** Callback for upload errors */
    onError?: (error: UploadError) => void;
    /** Callback for upload start */
    onStart?: (upload: Upload) => void;
}

/**
 * Get filename from File or Blob, with fallback
 */
export function getFileName(file: File | Blob, fallback = "file"): string {
    return (file as File).name || fallback;
}

export interface UploadProgress {
    /** Upload ID */
    id: string;
    /** Bytes uploaded so far */
    loaded: number;
    /** Total bytes to upload */
    total: number;
    /** Upload percentage (0-100) */
    percentage: number;
    /** Current upload speed in bytes per second */
    speed?: number;
    /** Estimated time remaining in seconds */
    eta?: number;
}

export interface UploadResult {
    /** Upload ID */
    id: string;
    /** Final URL of the uploaded file */
    url: string;
    /** File metadata */
    metadata: FileMetadata;
    /** Upload size in bytes */
    size: number;
}

export interface UploadError extends Error {
    /** Upload ID if available */
    id?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Error code */
    code?: string;
}

export interface Upload {
    /** Unique upload ID */
    id: string;
    /** Current upload state */
    state: "pending" | "uploading" | "paused" | "completed" | "error" | "cancelled";
    /** File being uploaded */
    file: File | Blob;
    /** Upload progress */
    progress: UploadProgress;
    /** Upload result (when completed) */
    result?: UploadResult;
    /** Upload error (when failed) */
    error?: UploadError;

    /** Start or resume the upload */
    start(): Promise<void>;
    /** Pause the upload */
    pause(): Promise<void>;
    /** Cancel the upload */
    cancel(): Promise<void>;
    /** Get current upload URL */
    getUrl(): string | null;
}

export interface TusUploadOptions extends UploadOptions {
    /** Tus-specific metadata */
    metadata?: FileMetadata & {
        /** Filename override */
        filename?: string;
        /** MIME type override */
        filetype?: string;
    };
}

export interface MultipartUploadOptions extends UploadOptions {
    /** Field name for the file in multipart form data */
    fieldName?: string;
    /** Additional form data fields */
    formData?: Record<string, string | Blob>;
}

export interface TusClientConfig extends UploadClientConfig {
    /** Tus protocol version */
    version?: "1.0.0";
    /** Supported Tus extensions */
    extensions?: string[];
    /** Checksum algorithms supported */
    checksumAlgorithms?: string[];
}

export interface MultipartClientConfig extends UploadClientConfig {
    /** Maximum file size for multipart uploads */
    maxFileSize?: number;
}
