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
const internalMatcher = match<PathMatch>(["/:uuid", "/*path/:uuid.:ext/:metadata", "/*path/:uuid/:metadata", "/*path/:uuid.:ext", "/*path/:uuid"], {
    decode: decodeURIComponent,
});

const filePathUrlMatcher = (path: string) => {
    const result = internalMatcher(path);

    if (!result) {
        return null;
    }

    // Ensure correct property order: params first, then path
    // Also recreate params object to ensure proper property order
    const { params } = result;
    const orderedParams: PathMatch = {};

    // Add properties in expected order: metadata, path, uuid, ext
    if (params.metadata !== undefined) {
        orderedParams.metadata = params.metadata;
    }

    if (params.path !== undefined) {
        orderedParams.path = params.path;
    }

    if (params.uuid !== undefined) {
        orderedParams.uuid = params.uuid;
    }

    if (params.ext !== undefined) {
        orderedParams.ext = params.ext;
    }

    return {
        params: orderedParams,
        path: result.path,
    };
};

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
