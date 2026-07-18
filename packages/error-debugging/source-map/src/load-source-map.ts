import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve, toNamespacedPath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { AnyMap } from "@jridgewell/trace-mapping";

import { SourceMapReadError } from "./errors";
import { SourceMapParseError } from "./parse-error";

const INLINE_SOURCEMAP_REGEX = /^data:application\/json[^,]+base64,/;
const REMOTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const DATA_URI_REGEX = /^data:/i;
const LINE_COMMENT_OPENER_REGEX = /^[ \t]*\/\/[@#][ \t]+$/;
const BLOCK_COMMENT_OPENER_REGEX = /^[ \t]*\/\*[@#][ \t]+$/;
const FORBIDDEN_VALUE_CHARS_REGEX = /[\s'"]/;

// eslint-disable-next-line no-secrets/no-secrets -- not a secret, sourceMappingURL marker
// Linear, allocation-free extraction of the `sourceMappingURL=` value to avoid the
// previously suppressed super-linear backtracking on the block-comment branch.
const SOURCEMAP_MARKER = "sourceMappingURL=";

const isInlineMap = (url: string): boolean => INLINE_SOURCEMAP_REGEX.test(url);

/**
 * Optional hook that lets callers resolve remote (`http(s):`) sourceMappingURLs.
 * Without it, remote maps are silently skipped (the historical behaviour).
 *
 * The hook receives the absolute URL discovered in the comment and must return
 * the raw source map JSON string (or `undefined` to skip).
 */
// eslint-disable-next-line import/exports-last -- public type referenced by option interfaces and function signatures below
export type RemoteMapResolver = (url: string) => string | undefined;

/**
 * Async variant of {@link RemoteMapResolver}, used by {@link loadSourceMapAsync}.
 */
// eslint-disable-next-line import/exports-last -- public type referenced by option interfaces and function signatures below
export type AsyncRemoteMapResolver = (url: string) => Promise<string | undefined> | string | undefined;

// eslint-disable-next-line import/exports-last -- public option type referenced by function signatures below
export interface LoadSourceMapOptions {
    /**
     * Resolve remote (`http(s):`) sourceMappingURLs. When omitted, remote maps
     * are skipped and `undefined` is returned.
     */
    remoteResolver?: RemoteMapResolver;
}

// eslint-disable-next-line import/exports-last -- public option type referenced by function signatures below
export interface LoadSourceMapAsyncOptions {
    /**
     * Resolve remote (`http(s):`) sourceMappingURLs. When omitted, remote maps
     * are skipped and `undefined` is returned.
     */
    remoteResolver?: AsyncRemoteMapResolver;
}

/**
 * A discovered map reference classified into one of:
 * - `inline` — a decodable inline `data:` map payload.
 * - `path` — an absolute filesystem path to a sibling `.map` file.
 * - `remote` — an absolute remote URL (`http(s):`) to be passed to a resolver.
 */
type ResolvedReference = { inline: string } | { path: string } | { remote: string };

/**
 * Validate the `sourceMappingURL` marker occurrence at `markerIndex` and, when it sits
 * inside a well-formed line/block comment with a usable value, return that value.
 * Returns `undefined` when the occurrence is not a valid comment reference so the
 * caller can keep scanning earlier occurrences.
 */
const extractSourceMappingURLAt = (sourceFile: string, markerIndex: number): string | undefined => {
    // The comment opener (`//` or `/*`) must be the first non-whitespace token on
    // its line, optionally preceded by `# ` / `@ ` after the opener. Walk back from
    // the marker to verify we are inside a comment, mirroring the original regex.
    let lineStart = sourceFile.lastIndexOf("\n", markerIndex);

    lineStart = lineStart === -1 ? 0 : lineStart + 1;

    const prefix = sourceFile.slice(lineStart, markerIndex);

    // Accept `//[@#][ \t]+` or `/*[@#][ \t]+` openers (leading whitespace allowed).
    const lineComment = LINE_COMMENT_OPENER_REGEX.test(prefix);
    const blockComment = BLOCK_COMMENT_OPENER_REGEX.test(prefix);

    if (!lineComment && !blockComment) {
        return undefined;
    }

    const valueStart = markerIndex + SOURCEMAP_MARKER.length;

    if (lineComment) {
        // Value runs to end-of-line; no quotes or whitespace permitted inside.
        let end = sourceFile.indexOf("\n", valueStart);

        if (end === -1) {
            end = sourceFile.length;
        }

        const value = sourceFile.slice(valueStart, end).trimEnd();

        // Reject empty / quoted / whitespace-containing values (the original
        // capture group was `[^\s'"]+`).
        if (value === "" || FORBIDDEN_VALUE_CHARS_REGEX.test(value)) {
            return undefined;
        }

        return value;
    }

    // Block comment: value runs up to the closing `*/`.
    const closeIndex = sourceFile.indexOf("*/", valueStart);

    if (closeIndex === -1) {
        return undefined;
    }

    // Everything after `*/` on the line must be whitespace (original `[ \t]*$`).
    let lineEnd = sourceFile.indexOf("\n", closeIndex);

    if (lineEnd === -1) {
        lineEnd = sourceFile.length;
    }

    const trailer = sourceFile.slice(closeIndex + 2, lineEnd);

    if (trailer.trim() !== "") {
        return undefined;
    }

    const value = sourceFile.slice(valueStart, closeIndex).trim();

    // The block-comment value historically could not contain `*`.
    if (value === "" || value.includes("*")) {
        return undefined;
    }

    return value;
};

/**
 * Locate the trailing `//# sourceMappingURL` (or `//@`) line/block comment in a
 * source file using a linear scan instead of splitting the whole file into
 * lines and regex-matching each one. This keeps memory flat and avoids regex
 * backtracking on large minified bundles that carry no comment at all.
 *
 * Occurrences are scanned from the end of the file backwards: if the last
 * occurrence of the marker is not a valid comment reference (e.g. it appears
 * inside a string literal in an appended chunk), earlier occurrences are still
 * considered, mirroring the pre-rewrite line-loop implementation.
 */
const findSourceMappingURL = (sourceFile: string): string | undefined => {
    let markerIndex = sourceFile.lastIndexOf(SOURCEMAP_MARKER);

    while (markerIndex !== -1) {
        const value = extractSourceMappingURLAt(sourceFile, markerIndex);

        if (value !== undefined) {
            return value;
        }

        markerIndex = sourceFile.lastIndexOf(SOURCEMAP_MARKER, markerIndex - 1);
    }

    return undefined;
};

/**
 * Classify a discovered sourceMappingURL into an inline payload, a local file
 * path, or a remote URL. Returns `undefined` when the reference is unusable
 * (e.g. a non-base64 `data:` URI).
 */
const resolveSourceMapReference = (sourceFile: string, sourceDirectory: string): ResolvedReference | undefined => {
    const url = findSourceMappingURL(sourceFile);

    if (!url) {
        return undefined;
    }

    if (isInlineMap(url)) {
        return { inline: url };
    }

    // Unsupported data: URI variants (e.g. URL-encoded, non-base64) are not decodable here; skip rather than treat as a path.
    if (DATA_URI_REGEX.test(url)) {
        return undefined;
    }

    // `file:` URLs are local maps but must be converted back to a path; passing
    // the raw `file:/...` string to `resolve()` would mangle it.
    if (url.startsWith("file:")) {
        return { path: fileURLToPath(url) };
    }

    // A remote (e.g. http/https) sourceMappingURL cannot be read from the local
    // filesystem; surface it so an optional resolver can fetch it.
    if (REMOTE_URL_REGEX.test(url)) {
        return { remote: url };
    }

    return { path: resolve(sourceDirectory, url) };
};

const decodeInlineMap = (data: string): string => {
    const rawData = data.slice(data.indexOf(",") + 1);

    return Buffer.from(rawData, "base64").toString();
};

const parseMap = (traceMapContent: string, mapBaseUrl: string, context: string): TraceMap => {
    try {
        return new AnyMap(traceMapContent, mapBaseUrl);
    } catch (error: unknown) {
        throw new SourceMapParseError(context, error);
    }
};

/**
 * The work still required to build a {@link TraceMap} from a reference:
 * - `map` — inline map already decoded and parsed synchronously.
 * - `path` — sibling `.map` file that still has to be read from disk.
 * - `remote` — remote URL that still has to be fetched via a resolver.
 */
type SourceMapPlan
    = | { kind: "map"; map: TraceMap }
        | { kind: "path"; mapPath: string; parseContext: string; readContext: string }
        | { kind: "remote"; parseContext: string; url: string };

/**
 * Classify a {@link ResolvedReference} into the work still required to build a
 * {@link TraceMap}, computing every read/parse error-context string once so the
 * sync ({@link loadSourceMapFromSource}) and async ({@link loadSourceMapAsync})
 * dispatchers share identical wording.
 *
 * `errorTarget` is the already-namespaced originating file (or `undefined` when
 * a caller loads directly from source without a backing file), matching the
 * historical per-path behaviour of both dispatchers.
 */
const planSourceMapLoad = (reference: ResolvedReference, errorTarget: string | undefined): SourceMapPlan => {
    if ("inline" in reference) {
        const inlineContext = errorTarget === undefined ? `Error parsing inline sourcemap` : `Error parsing sourcemap for file "${errorTarget}"`;

        return { kind: "map", map: parseMap(decodeInlineMap(reference.inline), reference.inline, inlineContext) };
    }

    if ("remote" in reference) {
        return { kind: "remote", parseContext: `Error parsing sourcemap for remote "${reference.remote}"`, url: reference.remote };
    }

    const fileContext = errorTarget ?? toNamespacedPath(reference.path);

    return {
        kind: "path",
        mapPath: reference.path,
        parseContext: `Error parsing sourcemap for file "${fileContext}"`,
        readContext: `Error reading sourcemap for file "${fileContext}"`,
    };
};

/**
 * Build a {@link TraceMap} from already-in-memory source code.
 *
 * This is the in-memory twin of {@link loadSourceMap}: bundler plugins and error
 * overlays that already hold the transformed code can skip the disk round-trip.
 *
 * - Inline (`data:application/json;base64,...`) maps are decoded directly.
 * - Relative / `file:` map references are read from disk, resolved against `sourceDirectory`.
 * - Remote (`http(s):`) references are resolved via `options.remoteResolver` if provided, otherwise skipped (returns `undefined`).
 * @param sourceCode The full source code containing a `sourceMappingURL` comment.
 * @param sourceDirectory Directory used to resolve relative `.map` references.
 * @param options Optional remote resolver hook.
 * @param sourceContextPath When set (by the file-based {@link loadSourceMap}), read/parse
 * errors reference this originating file instead of the resolved
 * `.map`/inline target, so messages name the file the caller asked about.
 * @returns A {@link TraceMap}, or `undefined` when no usable sourcemap is referenced.
 * @throws {SourceMapReadError}  When a referenced `.map` file cannot be read.
 * @throws {SourceMapParseError} When the source map cannot be parsed.
 */
// eslint-disable-next-line import/exports-last -- exported helper consumed by loadSourceMap below; keep declaration before its caller
export const loadSourceMapFromSource = (
    sourceCode: string,
    sourceDirectory: string,
    options: LoadSourceMapOptions = {},
    sourceContextPath?: string,
): TraceMap | undefined => {
    const reference = resolveSourceMapReference(sourceCode, sourceDirectory);

    if (!reference) {
        return undefined;
    }

    const errorTarget = sourceContextPath === undefined ? undefined : toNamespacedPath(sourceContextPath);
    const plan = planSourceMapLoad(reference, errorTarget);

    if (plan.kind === "map") {
        return plan.map;
    }

    if (plan.kind === "remote") {
        const resolved = options.remoteResolver?.(plan.url);

        if (resolved === undefined) {
            return undefined;
        }

        return parseMap(resolved, plan.url, plan.parseContext);
    }

    let traceMapContent: string;

    try {
        traceMapContent = readFileSync(plan.mapPath, { encoding: "utf8" });
    } catch (error: unknown) {
        throw new SourceMapReadError(plan.readContext, error);
    }

    return parseMap(traceMapContent, pathToFileURL(plan.mapPath).href, plan.parseContext);
};

/**
 * Read a JavaScript file from disk, locate its `sourceMappingURL`, load and parse
 * the referenced source map, and return a {@link TraceMap}.
 *
 * Behaviour notes (these are intentional and historically undocumented):
 * - Returns `undefined` when the file references **no** sourcemap, when the reference is a non-base64 `data:` URI, or when it is a remote (`http(s):`) URL and no `remoteResolver` is supplied.
 * - **Throws** {@link SourceMapReadError} if the JS file or its `.map` sibling cannot be read (the underlying error — including its `code` — is preserved on `error.cause`).
 * - **Throws** {@link SourceMapParseError} if the map cannot be parsed.
 * @param filename Absolute or relative path to the generated JavaScript file.
 * @param options Optional remote resolver hook.
 * @returns A {@link TraceMap}, or `undefined` when no usable sourcemap is referenced.
 */
const loadSourceMap = (filename: string, options: LoadSourceMapOptions = {}): TraceMap | undefined => {
    let sourceMapContent: string;

    try {
        sourceMapContent = readFileSync(filename, { encoding: "utf8" });
    } catch (error: unknown) {
        throw new SourceMapReadError(`Error reading sourcemap for file "${toNamespacedPath(filename)}"`, error);
    }

    return loadSourceMapFromSource(sourceMapContent, dirname(filename), options, filename);
};

/**
 * Promise-based twin of {@link loadSourceMap}. Uses `fs/promises` so server-side
 * stack remapping does not block the event loop per frame file.
 * @param filename Absolute or relative path to the generated JavaScript file.
 * @param options Optional (sync or async) remote resolver hook.
 * @returns A {@link TraceMap}, or `undefined` when no usable sourcemap is referenced.
 * @throws {SourceMapReadError}  When the JS file or its `.map` sibling cannot be read.
 * @throws {SourceMapParseError} When the map cannot be parsed.
 */
export const loadSourceMapAsync = async (filename: string, options: LoadSourceMapAsyncOptions = {}): Promise<TraceMap | undefined> => {
    let sourceMapContent: string;

    try {
        sourceMapContent = await readFile(filename, { encoding: "utf8" });
    } catch (error: unknown) {
        throw new SourceMapReadError(`Error reading sourcemap for file "${toNamespacedPath(filename)}"`, error);
    }

    const sourceDirectory = dirname(filename);
    const reference = resolveSourceMapReference(sourceMapContent, sourceDirectory);

    if (!reference) {
        return undefined;
    }

    const plan = planSourceMapLoad(reference, toNamespacedPath(filename));

    if (plan.kind === "map") {
        return plan.map;
    }

    if (plan.kind === "remote") {
        const resolved = await options.remoteResolver?.(plan.url);

        if (resolved === undefined) {
            return undefined;
        }

        return parseMap(resolved, plan.url, plan.parseContext);
    }

    let traceMapContent: string;

    try {
        traceMapContent = await readFile(plan.mapPath, { encoding: "utf8" });
    } catch (error: unknown) {
        throw new SourceMapReadError(plan.readContext, error);
    }

    return parseMap(traceMapContent, pathToFileURL(plan.mapPath).href, plan.parseContext);
};

export default loadSourceMap;
