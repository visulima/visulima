import { match } from "path-to-regexp";

/**
 * URL matcher function that extracts file identifiers from request paths.
 * Supports multiple URL patterns for flexible file addressing.
 * @example
 * ```ts
 * // Match /files/abc123.jpg/metadata
 * const match = filePathUrlMatcher("/files/abc123.jpg/metadata");
 * // { uuid: "abc123", ext: "jpg", metadata: "metadata" }
 * ```
 */
const filePathUrlMatcher = match<PathMatch>(["/:uuid", "/*path/:uuid.:ext/:metadata", "/*path/:uuid/:metadata", "/*path/:uuid.:ext", "/*path/:uuid"], {
    decode: decodeURIComponent,
});

/**
 * Parsed URL components from file path matching.
 */
export type PathMatch = {
    /** File extension (e.g., "jpg", "png") */
    ext?: string;
    /** Metadata request type (e.g., "metadata") */
    metadata?: string;
    /** Path segments before the UUID */
    path?: string[];
    /** File UUID identifier */
    uuid: string;
};

export default filePathUrlMatcher;
