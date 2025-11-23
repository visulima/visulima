import type { Readable } from "node:stream";

import type { File } from "../utils/file";

export interface SecurityHandler {
    name: string;
    /**
     * Validates the file content.
     * @param file The file metadata.
     * @param content The file content as a stream, buffer, or file path (string).
     * @throws {Error} If the validation fails.
     */
    validate: (file: File, content: Readable | Buffer | string) => Promise<void>;
}

export interface SecurityRule {
    handler: SecurityHandler;
    /**
     * MIME types to apply this rule to.
     * If not provided, applies to all files.
     * Supports wildcards (e.g. "image/*").
     */
    mimeTypes?: string[];
}

export interface SecurityConfig {
    /**
     * List of security rules to apply.
     */
    rules: SecurityRule[];
}
