/**
 * DOMPurify sanitizer, resolved without taking DOM-less runtimes down at import time.
 *
 * `isomorphic-dompurify` cannot be imported statically: its browser build binds
 * `DOMPurify.sanitize` at module scope, and DOMPurify leaves `sanitize` undefined when the runtime
 * has no DOM. On DOM-less edge runtimes (Cloudflare Workers / workerd, and anything else without
 * `window.document`) a static `import` therefore throws `TypeError: Cannot read properties of
 * undefined (reading 'bind')` while merely *loading* the module — taking the whole package down
 * before a single line of user code runs.
 *
 * It is pulled in with a top-level `await import(...)` inside `try`/`catch` instead. The await keeps
 * the resolution synchronous from every consumer's point of view (an importing module's body does
 * not run until this one has settled), so {@link purify} stays a plain synchronous function, while
 * the `catch` turns "no DOM" into a missing sanitizer rather than a crash.
 *
 * When no sanitizer resolves, callers fall back to plain HTML-entity escaping. That is stricter than
 * DOMPurify — no markup survives it — so the page degrades to escaped output instead of crashing.
 */

/** Signature of `DOMPurify.sanitize` as this package uses it. */
type SanitizeFunction = (source: string, config?: Record<string, unknown>) => string;

let sanitizeImplementation: SanitizeFunction | undefined;

try {
    const module = await import("isomorphic-dompurify");

    if (typeof module.sanitize === "function") {
        sanitizeImplementation = module.sanitize;
    }
} catch {
    // No DOM in this runtime (e.g. workerd). Callers fall back to entity escaping.
}

/**
 * Sanitize `value` with DOMPurify, or return `undefined` when no sanitizer is available (or it
 * threw) so the caller can apply its own escaping fallback.
 */
export const purify = (value: string, config?: Record<string, unknown>): string | undefined => {
    if (sanitizeImplementation === undefined) {
        return undefined;
    }

    try {
        return config === undefined ? sanitizeImplementation(value) : sanitizeImplementation(value, config);
    } catch {
        return undefined;
    }
};

/** Whether a DOMPurify sanitizer resolved for this runtime. Exposed for diagnostics and tests. */
export const hasSanitizer = (): boolean => sanitizeImplementation !== undefined;
