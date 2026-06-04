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
    const pauseMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 30_000;

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

export interface HttpValidationInput {
    extraVariables: Record<string, string>;
    perHostLimiter?: PerHostLimiter;
    secret: string;
    signal?: AbortSignal;
    validation: Record<string, unknown>;
}

export const runHttpValidation = async ({ extraVariables, perHostLimiter, secret, signal, validation }: HttpValidationInput): Promise<ValidationStatus> => {
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

    let response: Response;

    try {
        response = perHostLimiter ? await perHostLimiter.run(host, doFetch) : await doFetch();
    } catch {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);

        return "error";
    }

    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
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

    // Matchers are AND-combined — any rejection short-circuits. Await inside
    // the loop is intentional: each matcher may short-circuit the next, and
    // we share the single body read across matchers that need it.
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
