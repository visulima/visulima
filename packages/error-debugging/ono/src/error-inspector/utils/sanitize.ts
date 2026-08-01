import type { TemplateOptions } from "../types";
import { purify } from "./dompurify";

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
const toString = (value: unknown): string => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        return value.trim();
    }

    if (typeof value === "object" || Array.isArray(value)) {
        try {
            return JSON.stringify(value).trim();
        } catch {
            return "";
        }
    }

    // value is narrowed to number/boolean/bigint/symbol/function here; objects handled above
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value).trim();
};

/**
 * Escapes HTML entities for safe use in HTML attributes.
 *
 * Also the sanitization fallback for runtimes where DOMPurify cannot load (no DOM — e.g. workerd).
 * Escaping is strictly stronger than sanitizing: no markup survives it, so the output is safe even
 * though formatting is lost.
 */
export const escapeHtml = (value: string): string => value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char as keyof typeof HTML_ENTITIES]);

// Sanitizes HTML content using DOMPurify to prevent XSS attacks
export const sanitizeHtml = (value: unknown): string => {
    const stringValue = toString(value);

    return purify(stringValue) ?? escapeHtml(stringValue);
};

// Sanitizes values for use in HTML attributes with additional HTML entity escaping
export const sanitizeAttribute = (value: unknown): string => {
    const stringValue = toString(value);

    if (!stringValue) {
        return "";
    }

    const sanitized = purify(stringValue);

    if (sanitized === undefined) {
        // Fallback to manual escaping when DOMPurify is unavailable in this runtime.
        return escapeHtml(stringValue);
    }

    // DOMPurify sanitizes but we need to ensure quotes are escaped for attribute safety
    return sanitized.replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
};

// Validates and sanitizes URLs for safe use in HTML attributes
// Only allows HTTP/HTTPS URLs or relative paths
export const sanitizeUrlAttribute = (value: unknown): string => {
    const rawUrl = toString(value);

    if (!rawUrl) {
        return FALLBACK_URL;
    }

    // Without DOMPurify, entity-escaping the URL is the safe equivalent: the allowlist below still
    // decides whether the scheme may be emitted at all, so dropping to `#` would needlessly break
    // legitimate links on DOM-less runtimes.
    const sanitized = purify(rawUrl) ?? escapeHtml(rawUrl);
    const lowerUrl = sanitized.toLowerCase();

    // Check if URL starts with allowed prefixes
    const isAllowed = ALLOWED_URL_PREFIXES.some((prefix) => lowerUrl.startsWith(prefix));

    // Escape quotes so a value like `/x" onfocus="…` cannot break out of the surrounding attribute
    return isAllowed ? sanitized.replaceAll("\"", "&quot;").replaceAll("'", "&#39;") : FALLBACK_URL;
};

// Sanitizes HTML content while preserving code syntax highlighting classes
export const sanitizeCodeHtml = (value: unknown): string => {
    const stringValue = toString(value);

    if (!stringValue) {
        return "";
    }

    // Preserve styling/classes produced by syntax highlighters like Shiki
    return (
        purify(stringValue, {
            ADD_ATTR: ["class", "style"],
        })
        // Fallback to basic HTML sanitization if advanced options fail or DOMPurify is unavailable.
        ?? sanitizeHtml(stringValue)
    );
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
