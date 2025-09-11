import type { IncomingMessage } from "node:http";

// Feature detection for runtime compatibility
const hasNativeRequest = typeof globalThis !== "undefined" && "Request" in globalThis;
const hasNativeHeaders = typeof globalThis !== "undefined" && "Headers" in globalThis;

// Runtime type detection
const isNodeJS = typeof process !== "undefined" && process.versions?.node;
const isBun = typeof globalThis !== "undefined" && "Bun" in globalThis;
const isDeno = typeof globalThis !== "undefined" && "Deno" in globalThis;

// Extract native types safely
type NativeRequest = typeof globalThis.Request;
type NativeHeaders = typeof globalThis.Headers;

// Fallback interfaces for environments without native types
interface CustomHeaders {
    entries: () => IterableIterator<[string, string]>;
    forEach: (callback: (value: string, key: string) => void) => void;
    get: (name: string) => string | null;
}

interface CustomRequest {
    clone?: () => CustomRequest;
    headers?: Record<string, string | string[]> | CustomHeaders;
    json?: () => Promise<unknown>;
    method?: string;
    text?: () => Promise<string>;
    url?: string;
}

// Unified types that work across all runtimes
type HeadersLike = NativeHeaders | CustomHeaders;
type RequestLikeType = NativeRequest | CustomRequest;

// Flexible RequestLike interface that supports multiple request types
type RequestLike
    // Native Request (works in Node.js 18+, Bun, Deno, browsers)
    = | NativeRequest
    // Node.js IncomingMessage with extensions
        | (IncomingMessage & {
            body?: unknown;
            clone?: () => RequestLike;
            json?: () => Promise<unknown>;
            text?: () => Promise<string>;
        })
    // Custom request-like objects
        | CustomRequest
    // Express request objects
        | {
            body?: unknown;
            headers?: Record<string, string | string[]> | HeadersLike;
            method?: string;
            off?: (event: string, handler: (chunk: unknown) => void) => void;
            on?: (event: string, handler: (chunk: unknown) => void) => void;
            setEncoding?: (encoding: string) => void;
            url?: string;
        };

type ExpressRequest = {
    body?: unknown;
    headers?: Record<string, string | string[]> | HeadersLike;
    method?: string;
    url?: string;
};

// Helper functions for safe property access
const hasProperty = <T extends object, K extends PropertyKey>(object: T, property: K): object is Record<K, unknown> & T => property in object;

const hasMethod = <T extends object, K extends PropertyKey>(object: T, property: K): object is Record<K, (...arguments_: unknown[]) => unknown> & T =>
    hasProperty(object, property) && typeof (object as Record<K, unknown>)[property] === "function";

const hasStringProperty = <T extends object, K extends PropertyKey>(object: T, property: K): object is Record<K, string> & T =>
    hasProperty(object, property) && typeof (object as Record<K, unknown>)[property] === "string";

// Type guards for different request types
export const isNativeRequest = (request: RequestLike): request is NativeRequest => hasNativeRequest && hasMethod(request, "clone");

export const isIncomingMessage = (request: RequestLike): request is IncomingMessage => hasMethod(request, "on") && hasStringProperty(request, "method");

export const isExpressRequest = (request: RequestLike): request is ExpressRequest =>
    !isNativeRequest(request) && !isIncomingMessage(request) && hasStringProperty(request, "method");

// Utility functions for type checking
export const isHeadersObject = (object: unknown): object is HeadersLike =>
    typeof object === "object" && object !== null && hasMethod(object, "forEach") && hasMethod(object, "get");

// Header types
export type HeaderValue = string | string[] | undefined;
export type HeadersRecord = Record<string, HeaderValue>;
export type HeadersInput = HeadersRecord | HeadersLike | undefined;
export type HeadersOutput = Record<string, string | string[]> | undefined;

// Context types
export type ContextContentOptions = {
    context?: Record<string, unknown>;
    headerAllowlist?: string[];
    headerDenylist?: string[];
    maskValue?: string;
    previewBytes?: number;
    totalCapBytes?: number;
};

// Export statements
export type { HeadersLike, RequestLike, RequestLikeType };

// Export runtime detection constants
export const runtime = {
    hasNativeHeaders,
    hasNativeRequest,
    isBun,
    isDeno,
    isNodeJS,
} as const;
