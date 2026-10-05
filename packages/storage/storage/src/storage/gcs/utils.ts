import type { GaxiosError, RetryConfig } from "gaxios";

import type { FilePart } from "../utils/file";
import { hasContent } from "../utils/file";
import type GCSFile from "./gcs-file";

/**
 * The number of bytes a resumable session's `Range` header ("bytes=0-499") reports as persisted:
 * its end is inclusive, so "bytes=0-0" is one byte.
 */
export const getRangeEnd = (range: string): number => {
    // Input is controlled (HTTP Range header), safe from ReDoS
    const match = /(\d+)-(\d+)/.exec(range);

    return match ? Number(match[2]) + 1 : 0;
};

/**
 * The `Content-Range` of a resumable-session request: "bytes FIRST-LAST/TOTAL" for a chunk, and
 * "bytes *\/TOTAL" without one (a status query, or the empty last request of a deferred length).
 */
export const buildContentRange = (part: GCSFile & Partial<FilePart>): string => {
    if (hasContent(part) && part.contentLength !== 0) {
        const end = part.contentLength ? part.start + part.contentLength - 1 : "*";

        return `bytes ${part.start}-${end}/${part.size ?? "*"}`;
    }

    return `bytes */${part.size ?? "*"}`;
};

/**
 * A custom `shouldRetry` replaces gaxios' own check entirely, so the attempt cap, the per-request
 * `retry: false` (single-use stream bodies), the retryable methods and status codes are applied here.
 */
export const shouldRetry = (error: GaxiosError): boolean => {
    const { config, response } = error;
    const retryConfig = config.retryConfig ?? {};
    const attempt = retryConfig.currentRetryAttempt ?? 0;

    if (config.retry === false || config.signal?.aborted || attempt >= (retryConfig.retry ?? 0)) {
        return false;
    }

    if (!(retryConfig.httpMethodsToRetry ?? []).includes((config.method ?? "GET").toUpperCase())) {
        return false;
    }

    // No response: a network failure (ETIMEDOUT, EAI_AGAIN, ...).
    if (response === undefined) {
        return true;
    }

    // Gaxios types `data` as `{}`, so the error envelope's shape is stated here rather than inferred.
    const data = response.data as { error?: { errors?: { reason?: string }[] } } | undefined;
    const rateLimited = data?.error?.errors?.some(
        ({ reason = "" }) => reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason.includes("EAI_AGAIN"),
    );

    return rateLimited === true || (retryConfig.statusCodesToRetry ?? []).some(([min = 0, max = min]) => response.status >= min && response.status <= max);
};

export const retryOptions: RetryConfig = {
    retry: 3,
    shouldRetry,
    statusCodesToRetry: [
        [100, 199],
        [408, 408],
        [429, 429],
        [500, 599],
    ],
};
