/**
 * Enhanced HTTP header utilities using remix-run/headers for type-safe header manipulation.
 * This module provides internal utilities for the storage package to handle complex headers.
 */

import { Accept, ContentDisposition, ContentType } from "@remix-run/headers";

import type { Headers as UploadHeaders } from "./types";

/**
 * Formats a date as an HTTP-date (RFC 9110 §5.6.7), the form Last-Modified and If-Range use.
 * @param value Date, epoch milliseconds or a date string
 * @returns The HTTP-date, or the value as given when it isn't a valid date
 */
export const toHttpDate = (value: Date | number | string): string => {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? String(value) : date.toUTCString();
};

/**
 * Formats an entity tag as the ETag header carries it (RFC 9110 §8.8.3): quoted, keeping a `W/`
 * prefix. Adapters may hand back a bare value, which If-Match / If-Range would never match.
 * @param etag ETag as the adapter returned it
 * @returns The quoted entity tag
 */
export const toETagHeader = (etag: string): string => {
    const weak = etag.startsWith("W/");
    const tag = weak ? etag.slice(2) : etag;

    if (tag.length > 1 && tag.startsWith("\"") && tag.endsWith("\"")) {
        return etag;
    }

    return `${weak ? "W/" : ""}"${tag}"`;
};

/**
 * Replaces what a header value can't carry as-is: every UTF-16 code unit outside printable ASCII.
 * @param value Header value
 * @param replace Replacement of one code unit
 * @returns The value, safe to send
 */
export const toLatin1Safe = (value: string, replace: (unit: string) => string): string => value.replaceAll(/[^\u0020-\u007E]/g, replace);

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
 * Utility functions for working with HTTP headers using \@remix-run/headers.
 */
export const HeaderUtilities = {
    /**
     * Check if client accepts a specific media type based on Accept header.
     * @param acceptHeader HTTP Accept header value
     * @param mediaType Media type to check for acceptance
     * @returns True if the media type is accepted by the client
     */
    acceptsMediaType(acceptHeader: string | undefined, mediaType: string): boolean {
        const accept = this.parseAccept(acceptHeader);

        return accept ? accept.accepts(mediaType) : false;
    },

    /**
     * Create Cache-Control header value from options.
     * @param options Cache control directives configuration
     * @returns Cache-Control header value string
     */
    createCacheControl(options: CacheControlOptions): string {
        const directives: string[] = [];

        // Boolean directives
        if (options.public) {
            directives.push("public");
        }

        if (options.private) {
            directives.push("private");
        }

        if (options.noCache) {
            directives.push("no-cache");
        }

        if (options.noStore) {
            directives.push("no-store");
        }

        if (options.immutable) {
            directives.push("immutable");
        }

        if (options.mustRevalidate) {
            directives.push("must-revalidate");
        }

        if (options.proxyRevalidate) {
            directives.push("proxy-revalidate");
        }

        // Time-based directives
        if (options.maxAge !== undefined) {
            directives.push(`max-age=${options.maxAge}`);
        }

        if (options.sMaxAge !== undefined) {
            directives.push(`s-maxage=${options.sMaxAge}`);
        }

        if (options.minFresh !== undefined) {
            directives.push(`min-fresh=${options.minFresh}`);
        }

        if (options.staleWhileRevalidate !== undefined) {
            directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
        }

        if (options.staleIfError !== undefined) {
            directives.push(`stale-if-error=${options.staleIfError}`);
        }

        return directives.join(", ");
    },

    /**
     * Create common cache control presets with predefined configurations.
     * @param preset Preset name ('no-cache', 'no-store', 'public', 'private', or 'immutable')
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
     * Create a Content-Disposition header value. A name that isn't plain printable ASCII gets an ASCII
     * fallback in `filename` and its exact form in `filename*` (RFC 6266 / RFC 8187), so the header
     * never carries raw non-Latin-1 text, quotes or line breaks.
     * @param options.filename File name to suggest
     * @param options.type `inline` or `attachment`
     * @returns Content-Disposition header value
     */
    createContentDisposition(options: { filename?: string; type: "inline" | "attachment" }): string {
        const { filename, type } = options;

        if (!filename) {
            return type;
        }

        const fallback = toLatin1Safe(filename, () => "_").replaceAll(/["\\]/gu, "_");
        const header = `${type}; filename="${fallback}"`;

        if (fallback === filename) {
            return header;
        }

        const encoded = encodeURIComponent(filename).replaceAll(/['()*]/gu, (character) => `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`);

        return `${header}; filename*=UTF-8''${encoded}`;
    },

    /**
     * Create Content-Type header value from structured data with optional charset and boundary.
     * @param options
     * @param options.boundary Multipart boundary string
     * @param options.charset Character encoding (e.g., 'utf8')
     * @param options.mediaType MIME media type (e.g., 'application/json')
     * @returns Content-Type header value string
     */
    createContentType(options: { boundary?: string; charset?: string; mediaType: string }): string {
        const contentType = new ContentType({
            mediaType: options.mediaType,
            ...(options.charset && { charset: options.charset }),
            ...(options.boundary && { boundary: options.boundary }),
        });

        return contentType.toString();
    },

    /**
     * Get content type with charset if not already present.
     * @param contentType Content-Type header value to ensure charset for
     * @param defaultCharset Default charset to use if not present (default: 'utf8')
     * @returns Content-Type header value with charset ensured
     */
    ensureCharset(contentType: string, defaultCharset = "utf8"): string {
        const ct = this.parseContentType(contentType);

        if (!ct) {
            return contentType;
        }

        if (!ct.charset) {
            ct.charset = defaultCharset;
        }

        return ct.toString();
    },

    /**
     * Convert our Headers type to native Headers object.
     * @param headers Headers in array or object format
     * @returns Headers instance with converted header values
     */
    fromHeaders(headers: UploadHeaders): Headers {
        const enhanced = new Headers();

        if (Array.isArray(headers)) {
            (headers as [string, unknown][]).forEach(([name, value]) => {
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
     * @param acceptHeader HTTP Accept header value
     * @param supportedTypes Array of supported MIME types to match against
     * @returns Best matching media type or undefined if no match found
     */
    getPreferredMediaType(acceptHeader: string | undefined, supportedTypes: string[]): string | undefined {
        const accept = this.parseAccept(acceptHeader);

        if (!accept) {
            return undefined;
        }

        for (const type of supportedTypes) {
            if (accept.accepts(type)) {
                return type;
            }
        }

        return undefined;
    },

    /**
     * Parse Accept header with quality factor support.
     * @param headerValue HTTP Accept header value to parse
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
     * @param headerValue HTTP Content-Disposition header value to parse
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
     * @param headerValue HTTP Content-Type header value to parse
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
