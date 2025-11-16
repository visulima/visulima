/**
 * Upload method type for useUpload hook
 */
export type UploadMethod = "auto" | "multipart" | "tus";

/**
 * File metadata returned from the server (matches OpenAPI FileMeta schema)
 */
export interface FileMeta {
    /** Bytes written to storage */
    bytesWritten?: number;
    /** Content type of the uploaded file */
    contentType?: string;
    /** File creation timestamp */
    createdAt?: string;
    /** Unique identifier for the uploaded file */
    id: string;
    /** Additional metadata associated with the file */
    metadata?: Record<string, unknown>;
    /** Storage name of the file */
    name?: string;
    /** Original filename of the uploaded file */
    originalName?: string;
    /** Size of the uploaded file in bytes */
    size?: number;
    /** Upload status: 'completed', 'part', 'deleted', or 'created' */
    status?: "completed" | "part" | "deleted" | "created";
}

/**
 * Result returned after a successful file upload
 * Extends FileMeta with additional client-side fields
 */
export interface UploadResult extends FileMeta {
    /** Original filename of the uploaded file (alias for originalName) */
    filename?: string;
    /** Current upload offset in bytes (TUS only) */
    offset?: number;
    /** URL to access the uploaded file */
    url?: string;
}

/**
 * Upload item state (used by internal uploader)
 */
export interface UploadItem {
    /** Upload progress percentage (0-100) */
    completed: number;
    /** Error message if upload failed */
    error?: string;
    /** The file being uploaded */
    file: File;
    /** Unique item ID */
    id: string;
    /** Bytes uploaded so far */
    loaded: number;
    /** Total file size in bytes */
    size: number;
    /** Upload status */
    status: "pending" | "uploading" | "completed" | "error" | "aborted";
    /** Upload response data */
    uploadResponse?: {
        data?: unknown;
        response?: string;
    };
    /** File URL after upload */
    url?: string;
}
