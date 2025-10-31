/**
 * Enhanced HTTP header utilities using @remix-run/headers for type-safe header manipulation.
 * This module provides internal utilities for the storage package to handle complex headers.
 */

import { Accept, ContentDisposition, ContentType, SuperHeaders } from "@remix-run/headers";

import type { Headers as UploadHeaders } from "./types";

/**
 * Cache-Control directive options
 */
export interface CacheControlOptions {
    immutable?: boolean;
    maxAge?: number;
    minFresh?: number;
    mustRevalidate?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    private?: boolean;
    proxyRevalidate?: boolean;
    public?: boolean;
    sMaxAge?: number;
    staleIfError?: number;
    staleWhileRevalidate?: number;
}

/**
 * Utility functions for working with HTTP headers using @remix-run/headers
 */
export const HeaderUtilities = {
    /**
     * Check if client accepts a specific media type
     */
    acceptsMediaType(acceptHeader: string | undefined, mediaType: string): boolean {
        const accept = this.parseAccept(acceptHeader);

        return accept ? accept.accepts(mediaType) : false;
    },

    /**
     * Create Cache-Control header from options
     */
    createCacheControl(options: CacheControlOptions): string {
        const directives: string[] = [];

        // Boolean directives
        if (options.public)
            directives.push("public");

        if (options.private)
            directives.push("private");

        if (options.noCache)
            directives.push("no-cache");

        if (options.noStore)
            directives.push("no-store");

        if (options.immutable)
            directives.push("immutable");

        if (options.mustRevalidate)
            directives.push("must-revalidate");

        if (options.proxyRevalidate)
            directives.push("proxy-revalidate");

        // Time-based directives
        if (options.maxAge !== undefined)
            directives.push(`max-age=${options.maxAge}`);

        if (options.sMaxAge !== undefined)
            directives.push(`s-maxage=${options.sMaxAge}`);

        if (options.minFresh !== undefined)
            directives.push(`min-fresh=${options.minFresh}`);

        if (options.staleWhileRevalidate !== undefined)
            directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);

        if (options.staleIfError !== undefined)
            directives.push(`stale-if-error=${options.staleIfError}`);

        return directives.join(", ");
    },

    /**
     * Create common cache control presets
     */
    createCacheControlPreset(preset: "no-cache" | "no-store" | "public" | "private" | "immutable"): string {
        const presets = {
            immutable: { immutable: true, maxAge: 31_536_000 }, // 1 year
            "no-cache": { noCache: true },
            "no-store": { noStore: true },
            private: { maxAge: 3600, private: true }, // 1 hour default
            public: { maxAge: 3600, public: true }, // 1 hour default
        };

        return this.createCacheControl(presets[preset]);
    },

    /**
     * Create Content-Disposition header for file downloads
     */
    createContentDisposition(options: { filename?: string; filenameSplat?: string; type: "inline" | "attachment" }): string {
        const disposition = new ContentDisposition({
            type: options.type,
            ...options.filename && { filename: options.filename },
            ...options.filenameSplat && { filenameSplat: options.filenameSplat },
        });

        return disposition.toString();
    },

    /**
     * Create Content-Type header value from structured data
     */
    createContentType(options: { boundary?: string; charset?: string; mediaType: string }): string {
        const contentType = new ContentType({
            mediaType: options.mediaType,
            ...options.charset && { charset: options.charset },
            ...options.boundary && { boundary: options.boundary },
        });

        return contentType.toString();
    },

    /**
     * Get content type with charset if not already present
     */
    ensureCharset(contentType: string, defaultCharset = "utf8"): string {
        const ct = this.parseContentType(contentType);

        if (!ct)
            return contentType;

        if (!ct.charset) {
            ct.charset = defaultCharset;
        }

        return ct.toString();
    },

    /**
     * Convert our Headers type to EnhancedHeaders
     */
    fromHeaders(headers: UploadHeaders): SuperHeaders {
        const enhanced = new SuperHeaders();

        if (Array.isArray(headers)) {
            headers.forEach(([name, value]) => {
                enhanced.set(name, Array.isArray(value) ? value.join(", ") : String(value));
            });
        } else {
            Object.entries(headers).forEach(([name, value]) => {
                enhanced.set(name, Array.isArray(value) ? value.join(", ") : String(value));
            });
        }

        return enhanced;
    },

    /**
     * Get preferred media type from Accept header
     */
    getPreferredMediaType(acceptHeader: string | undefined, supportedTypes: string[]): string | undefined {
        const accept = this.parseAccept(acceptHeader);

        if (!accept)
            return undefined;

        for (const type of supportedTypes) {
            if (accept.accepts(type)) {
                return type;
            }
        }

        return undefined;
    },

    /**
     * Parse Accept header with quality factor support
     */
    parseAccept(headerValue: string | undefined): Accept | undefined {
        if (!headerValue) {
            return undefined;
        }

        try {
            return new Accept(headerValue);
        } catch {
            return undefined;
        }
    },

    /**
     * Parse Content-Disposition header
     */
    parseContentDisposition(headerValue: string | undefined): ContentDisposition | undefined {
        if (!headerValue) {
            return undefined;
        }

        try {
            return new ContentDisposition(headerValue);
        } catch {
            return undefined;
        }
    },

    /**
     * Parse Content-Type header with structured access
     */
    parseContentType(headerValue: string | undefined): ContentType | undefined {
        if (!headerValue) {
            return undefined;
        }

        try {
            return new ContentType(headerValue);
        } catch {
            return undefined;
        }
    },
};
