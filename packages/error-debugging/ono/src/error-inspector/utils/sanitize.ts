import DOMPurify from "isomorphic-dompurify";

import type { TemplateOptions } from "../types";

/**
 * Constants for URL validation and character escaping
 */
const ALLOWED_URL_PREFIXES = ["http://", "https://", "/", "./", "../"] as const;
const FALLBACK_URL = "#";

// HTML entity mappings for attribute escaping
const HTML_ENTITIES = {
    "\"": "&quot;",
    "&": "&amp;",
    "'": "&#39;",
    "<": "&lt;",
    ">": "&gt;",
} as const;

// Regular expression for validating CSP nonces
// CSP nonces may be base64 or base64url; allow +, /, -, _ and up to two '=' padding chars
const CSP_NONCE_PATTERN = /^[\w+/-]+={0,2}$/;

// Converts a value to a string, handling null/undefined cases
const toString = (value: unknown): string => String(value ?? "").trim();

// Escapes HTML entities for safe use in HTML attributes
const escapeHtml = (value: string): string => value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char as keyof typeof HTML_ENTITIES]);

// Sanitizes HTML content using DOMPurify to prevent XSS attacks
export const sanitizeHtml = (value: unknown): string => {
    try {
        return DOMPurify.sanitize(toString(value));
    } catch {
        // Fallback to basic escaping if DOMPurify fails
        return escapeHtml(toString(value));
    }
};

// Sanitizes values for use in HTML attributes with additional HTML entity escaping
export const sanitizeAttribute = (value: unknown): string => {
    const stringValue = toString(value);

    if (!stringValue) {
        return "";
    }

    try {
        // DOMPurify sanitizes but we need to ensure quotes are escaped for attribute safety
        const sanitized = DOMPurify.sanitize(stringValue);

        return sanitized.replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
    } catch {
        // Fallback to manual escaping if DOMPurify fails
        return escapeHtml(stringValue);
    }
};

// Validates and sanitizes URLs for safe use in HTML attributes
// Only allows HTTP/HTTPS URLs or relative paths
export const sanitizeUrlAttribute = (value: unknown): string => {
    const rawUrl = toString(value);

    if (!rawUrl) {
        return FALLBACK_URL;
    }

    try {
        const sanitized = DOMPurify.sanitize(rawUrl);
        const lowerUrl = sanitized.toLowerCase();

        // Check if URL starts with allowed prefixes
        const isAllowed = ALLOWED_URL_PREFIXES.some((prefix) => lowerUrl.startsWith(prefix));

        return isAllowed ? sanitized : FALLBACK_URL;
    } catch {
        // Return safe fallback if sanitization fails
        return FALLBACK_URL;
    }
};

// Sanitizes HTML content while preserving code syntax highlighting classes
export const sanitizeCodeHtml = (value: unknown): string => {
    const stringValue = toString(value);

    if (!stringValue) {
        return "";
    }

    try {
        // Preserve styling/classes produced by syntax highlighters like Shiki
        return DOMPurify.sanitize(stringValue, {
            ADD_ATTR: ["class", "style"],
        });
    } catch {
        // Fallback to basic HTML sanitization if advanced options fail
        return sanitizeHtml(stringValue);
    }
};

// Validates and sanitizes Content Security Policy nonces
export const sanitizeCspNonce = (value: unknown): string | undefined => {
    const nonceValue = toString(value);

    if (!nonceValue) {
        return undefined;
    }

    // CSP nonces should only contain base64 characters and hyphens
    return CSP_NONCE_PATTERN.test(nonceValue) ? nonceValue : undefined;
};

// Sanitizes all user-controlled template options to prevent XSS attacks
export const sanitizeOptions = (options: TemplateOptions = {}): TemplateOptions => {
    if (!options || typeof options !== "object") {
        return {};
    }

    try {
        return {
            ...options,
            cspNonce: sanitizeCspNonce(options.cspNonce),
            openInEditorUrl: options.openInEditorUrl ? sanitizeUrlAttribute(options.openInEditorUrl) : undefined,
        };
    } catch {
        // Return safe defaults if sanitization fails
        return {
            ...options,
            cspNonce: undefined,
            openInEditorUrl: undefined,
        };
    }
};
