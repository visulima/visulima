import type { Readable } from "node:stream";

import type { File } from "../utils/file";

export interface ScanResult {
    /**
     * Whether a threat was detected.
     */
    detected: boolean;

    /**
     * Additional metadata about the result (e.g. virus name, score).
     */
    metadata?: Record<string, unknown>;

    /**
     * Description of the threat or reason for flagging.
     */
    reason?: string;
}

export interface SecurityScanner {
    name: string;
    /**
     * Scans the file content for threats.
     * @param file The file metadata.
     * @param content The file content as a stream, buffer, or file path (string).
     * @returns Promise resolving to the scan result.
     */
    scan: (file: File, content: Readable | Buffer | string) => Promise<ScanResult>;
}

export interface SecurityRule {
    /**
     * Maximum file size to scan in bytes.
     * Files larger than this will skip this scanner.
     */
    maxSize?: number;

    /**
     * MIME types to apply this scanner to.
     * If not provided, applies to all files.
     * Supports wildcards (e.g. "image/*").
     */
    mimeTypes?: string[];

    scanner: SecurityScanner;
}

export interface SecurityConfig {
    /**
     * List of scanners or rules to apply.
     */
    scanners: (SecurityRule | SecurityScanner)[];
}
