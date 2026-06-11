// HTTP validator — takes a rule's `validation: { type: "Http", … }` block,
// renders the URL/headers/body against the template vars, fires one `fetch()`,
// and AND-combines every supported response matcher (StatusMatch, WordMatch,
// JsonValid, HeaderMatch) into a terminal `ValidationStatus`.

import type { ValidationStatus } from "../types";
import type { PerHostLimiter } from "./per-host-limiter";
import { renderTemplate } from "./template";

export interface HttpRequestTemplate {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
    response_matcher?: ResponseMatcher[];
    url: string;
}

// eslint-disable-next-line @stylistic/operator-linebreak -- prettier places `=` at end-of-line for union type declarations; honour its formatting.
export type ResponseMatcher =
    | { expected: string[] | string; header: string; type: "HeaderMatch" }
    | { match_all_words?: boolean; type: "WordMatch"; words: string[] }
    | { report_response?: boolean }
    | { status: number[]; type: "StatusMatch" }
    | { type: "JsonValid" };

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Hard cap on how long a single `Retry-After` may pause a host. A hostile or
 * misconfigured endpoint can answer `429` with `Retry-After: 86400` (a day) and
 * stall every pending validation for that host. We honour the header up to this
 * ceiling and clamp anything larger so one bad response can't wedge the scan.
 */
const MAX_RETRY_AFTER_MS = 5 * 60 * 1000;
const SUPPORTED_MATCHER_TYPES = new Set(["HeaderMatch", "JsonValid", "StatusMatch", "WordMatch"]);

const asObject = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === "object" && value !== null) {
        return value as Record<string, unknown>;
    }

    return undefined;
};

const renderHeaders = (headers: Record<string, string> | undefined, variables: Record<string, string>): Record<string, string> | undefined => {
    const rendered: Record<string, string> = {};

    if (!headers) {
        return rendered;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (typeof value !== "string") {
            continue;
        }

        const out = renderTemplate(value, variables);

        if (out === undefined) {
            return undefined;
        }

        rendered[key] = out;
    }

    return rendered;
};

/**
 * Filter response-matcher entries to the ones we understand in a single pass
 * and report whether any supported matcher survived. `report_response: true`
 * is metadata-only (Kingfisher uses it for debug captures), so we drop it; a
 * block with *only* `report_response` or unsupported types falls through to
 * `"skipped"` rather than the default `"verified"`.
 */
const collectMatchers = (raw: unknown): { hasSupported: boolean; matchers: ResponseMatcher[] } => {
    if (!Array.isArray(raw)) {
        return { hasSupported: false, matchers: [] };
    }

    const matchers: ResponseMatcher[] = [];
    let hasSupported = false;

    for (const matcher of raw) {
        const record = asObject(matcher);

        if (record === undefined || record["report_response"] === true) {
            continue;
        }

        matchers.push(matcher as ResponseMatcher);

        if (typeof record["type"] === "string" && SUPPORTED_MATCHER_TYPES.has(record["type"])) {
            hasSupported = true;
        }
    }

    return { hasSupported, matchers };
};

const observeRateLimit = (response: Response, perHostLimiter: PerHostLimiter | undefined, host: string): void => {
    if (!perHostLimiter || (response.status !== 429 && response.status !== 503)) {
        return;
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
    const requestedMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 30_000;
    // Clamp to the ceiling: a single `Retry-After: 86400` must not pause every
    // pending validation for that host for a day.
    const pauseMs = Math.min(requestedMs, MAX_RETRY_AFTER_MS);

    perHostLimiter.notifyRetryAfter(host, Date.now() + pauseMs);
};

type ReadBody = () => Promise<string | undefined>;

const checkStatusMatch = (matcher: { status?: unknown }, response: Response): ValidationStatus | undefined => {
    const allowed = Array.isArray(matcher.status) ? (matcher.status as number[]) : [];

    return allowed.includes(response.status) ? undefined : "rejected";
};

const checkWordMatch = async (matcher: { match_all_words?: unknown; words?: unknown }, readBody: ReadBody): Promise<ValidationStatus | undefined> => {
    const words = Array.isArray(matcher.words) ? matcher.words.filter((word): word is string => typeof word === "string") : [];

    if (words.length === 0) {
        return undefined;
    }

    const body = await readBody();

    if (body === undefined) {
        return "error";
    }

    const matchAll = Boolean(matcher.match_all_words);
    const passes = matchAll ? words.every((word) => body.includes(word)) : words.some((word) => body.includes(word));

    return passes ? undefined : "rejected";
};

const checkJsonValid = async (readBody: ReadBody): Promise<ValidationStatus | undefined> => {
    const body = await readBody();

    if (body === undefined) {
        return "error";
    }

    try {
        JSON.parse(body);

        return undefined;
    } catch {
        return "rejected";
    }
};

const normaliseExpected = (expected: unknown): string[] => {
    if (Array.isArray(expected)) {
        return expected.filter((entry): entry is string => typeof entry === "string");
    }

    return typeof expected === "string" ? [expected] : [];
};

const checkHeaderMatch = (matcher: { expected?: unknown; header?: unknown }, response: Response): ValidationStatus | undefined => {
    if (typeof matcher.header !== "string") {
        return "skipped";
    }

    const expected = normaliseExpected(matcher.expected);

    if (expected.length === 0) {
        return undefined;
    }

    // `Headers.get()` is case-insensitive per the WHATWG fetch spec — no need
    // to try both casings.
    const actual = response.headers.get(matcher.header);

    if (actual === null || !expected.some((entry) => actual === entry || actual.startsWith(`${entry};`))) {
        return "rejected";
    }

    return undefined;
};

/**
 * Whether `url`'s host is permitted by the allowlist. `undefined` allowlist =
 * any host allowed (legacy/bundled-trusted behaviour). An unparseable URL is
 * rejected so a malformed template can't slip past the gate.
 */
const isHostAllowed = (url: string, allowedHosts: ReadonlySet<string> | undefined): boolean => {
    if (allowedHosts === undefined) {
        return true;
    }

    try {
        return allowedHosts.has(new URL(url).host.toLowerCase());
    } catch {
        return false;
    }
};

/**
 * AND-combine every supported response matcher into a terminal status. Returns
 * `"verified"` only when every matcher passes; the first matcher that produces a
 * non-`undefined` verdict short-circuits. Body reads are shared via `readBody`.
 */
const evaluateMatchers = async (matchers: ResponseMatcher[], response: Response, readBody: ReadBody): Promise<ValidationStatus> => {
    for (const matcher of matchers) {
        const typed = asObject(matcher) as { type?: string };
        let verdict: ValidationStatus | undefined;

        switch (typed.type) {
            case "HeaderMatch": {
                verdict = checkHeaderMatch(typed as { expected?: unknown; header?: unknown }, response);

                break;
            }
            case "JsonValid": {
                // eslint-disable-next-line no-await-in-loop
                verdict = await checkJsonValid(readBody);

                break;
            }
            case "StatusMatch": {
                verdict = checkStatusMatch(typed as { status?: unknown }, response);

                break;
            }
            case "WordMatch": {
                // eslint-disable-next-line no-await-in-loop
                verdict = await checkWordMatch(typed as { match_all_words?: unknown; words?: unknown }, readBody);

                break;
            }
            default: {
                // Unknown matcher — we can't prove verification. Fall back to skipped.
                return "skipped";
            }
        }

        if (verdict !== undefined) {
            return verdict;
        }
    }

    return "verified";
};

export interface HttpValidationInput {
    /**
     * When set, the rendered request host must be in this set or validation is
     * skipped without firing the request. Closes the untrusted-config
     * exfiltration channel: a shared/third-party rule config can otherwise
     * point `validation.url` at an attacker host and leak every matching secret.
     * Hosts are compared case-insensitively against `URL.host` (host:port).
     */
    allowedHosts?: ReadonlySet<string>;
    extraVariables: Record<string, string>;
    perHostLimiter?: PerHostLimiter;
    secret: string;
    signal?: AbortSignal;
    validation: Record<string, unknown>;
}

export const runHttpValidation = async ({ allowedHosts, extraVariables, perHostLimiter, secret, signal, validation }: HttpValidationInput): Promise<ValidationStatus> => {
    const content = asObject(validation["content"]);
    const request = asObject(content?.["request"]) as HttpRequestTemplate | undefined;

    if (!request || typeof request.url !== "string") {
        return "skipped";
    }

    const variables: Record<string, string> = { ...extraVariables, TOKEN: secret };
    const url = renderTemplate(request.url, variables);

    if (url === undefined) {
        return "skipped";
    }

    // Host allowlist gate. Resolved before any header/body rendering so a
    // disallowed host never gets the secret interpolated into a request.
    if (!isHostAllowed(url, allowedHosts)) {
        return "skipped";
    }

    const headers = renderHeaders(request.headers, variables);

    if (headers === undefined) {
        return "skipped";
    }

    let body: string | undefined;

    if (typeof request.body === "string") {
        const rendered = renderTemplate(request.body, variables);

        if (rendered === undefined) {
            return "skipped";
        }

        body = rendered;
    }

    const { hasSupported, matchers } = collectMatchers(request.response_matcher);

    if (matchers.length === 0 || !hasSupported) {
        return "skipped";
    }

    // Already-aborted signal: bail before firing the request. `addEventListener`
    // never fires for a signal that aborted before we subscribed, so this guard
    // is the only thing that honours a pre-aborted host cancellation.
    if (signal?.aborted) {
        return "error";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort("timeout");
    }, DEFAULT_TIMEOUT_MS);

    const onAbort = () => {
        controller.abort(signal?.reason);
    };

    if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
    }

    const host = perHostLimiter?.hostFromUrl(url) ?? "";
    const doFetch = async (): Promise<Response> =>
        await fetch(url, {
            body,
            headers,
            method: (request.method ?? "GET").toUpperCase(),
            redirect: "manual",
            signal: controller.signal,
        });

    // Cleanup is deferred until *after* the body read so the abort timer stays
    // armed through `response.text()`. A slow-loris server that resolves the
    // fetch but then trickles the body would otherwise stall the worker
    // indefinitely (the timer used to be cleared the moment the fetch settled).
    const cleanup = (): void => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
    };

    let response: Response;

    try {
        response = perHostLimiter ? await perHostLimiter.run(host, doFetch) : await doFetch();
    } catch {
        cleanup();

        return "error";
    }

    observeRateLimit(response, perHostLimiter, host);

    // Lazy body fetch — we only read + cache it when a matcher needs it.
    // Stored as `null` sentinel (distinct from "not yet read" undefined) once
    // read, so concurrent matcher reads coalesce to one `response.text()`.
    let bodyCache: string | undefined;
    let bodyRead = false;
    const readBody: ReadBody = async () => {
        if (bodyRead) {
            return bodyCache;
        }

        bodyRead = true;

        try {
            bodyCache = await response.text();
        } catch {
            bodyCache = undefined;
        }

        return bodyCache;
    };

    // Matchers are AND-combined in `evaluateMatchers`. The `try/finally`
    // guarantees the abort timer/listener survives every body read (matchers
    // call `readBody`) and is torn down on every exit path — a slow-loris body
    // stays under the timeout, and cleanup runs even if a matcher throws.
    try {
        return await evaluateMatchers(matchers, response, readBody);
    } finally {
        cleanup();
    }
};
