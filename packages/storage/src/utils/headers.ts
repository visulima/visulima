/**
 * Enhanced HTTP header utilities using remix-run/headers for type-safe header manipulation.
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
     * Check if client accepts a specific media type based on Accept header.
     * @param acceptHeader - HTTP Accept header value
     * @param mediaType - Media type to check for acceptance
     * @returns True if the media type is accepted by the client
     */
    acceptsMediaType(acceptHeader: string | undefined, mediaType: string): boolean {
        const accept = this.parseAccept(acceptHeader);

        return accept ? accept.accepts(mediaType) : false;
    },

    /**
     * Create Cache-Control header value from options.
     * @param options - Cache control directives configuration
     * @returns Cache-Control header value string
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
     * Create common cache control presets with predefined configurations.
     * @param preset - Preset name ('no-cache', 'no-store', 'public', 'private', or 'immutable')
     * @returns Cache-Control header value string for the preset
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
     * Create Content-Disposition header for file downloads with optional filename.
     * @param options - Content disposition options
     * @param options.filename - Filename for the download
     * @param options.filenameSplat - Alternative filename format
     * @param options.type - Disposition type ('inline' or 'attachment')
     * @returns Content-Disposition header value string
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
     * Create Content-Type header value from structured data with optional charset and boundary.
     * @param options - Content type options
     * @param options.boundary - Multipart boundary string
     * @param options.charset - Character encoding (e.g., 'utf8')
     * @param options.mediaType - MIME media type (e.g., 'application/json')
     * @returns Content-Type header value string
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
     * Get content type with charset if not already present.
     * @param contentType - Content-Type header value to ensure charset for
     * @param defaultCharset - Default charset to use if not present (default: 'utf8')
     * @returns Content-Type header value with charset ensured
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
     * Convert our Headers type to EnhancedHeaders from remix-run/headers.
     * @param headers - Headers in array or object format
     * @returns SuperHeaders instance with converted header values
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
     * Get preferred media type from Accept header based on quality factors and supported types.
     * @param acceptHeader - HTTP Accept header value
     * @param supportedTypes - Array of supported MIME types to match against
     * @returns Best matching media type or undefined if no match found
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
     * Parse Accept header with quality factor support.
     * @param headerValue - HTTP Accept header value to parse
     * @returns Accept instance or undefined if header is invalid or missing
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
     * Parse Content-Disposition header into structured object.
     * @param headerValue - HTTP Content-Disposition header value to parse
     * @returns ContentDisposition instance or undefined if header is invalid or missing
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
     * Parse Content-Type header with structured access to media type, charset, and boundary.
     * @param headerValue - HTTP Content-Type header value to parse
     * @returns ContentType instance or undefined if header is invalid or missing
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
