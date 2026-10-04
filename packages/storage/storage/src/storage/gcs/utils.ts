import type { GaxiosError, RetryConfig } from "gaxios";

import type { FilePart } from "../utils/file";
import { hasContent } from "../utils/file";
import type GCSFile from "./gcs-file";

export const getRangeEnd = (range: string): number => {
    // Match patterns like "bytes 0-499/1234" or "0-499"
    // Input is controlled (HTTP Range header), safe from ReDoS

    const match = range.match(/(\d+)-(\d+)/);

    const end = match?.[2] ? +match[2] : 0;

    return end > 0 ? end + 1 : 0;
};

export const buildContentRange = (part: GCSFile & Partial<FilePart>): string => {
    if (hasContent(part)) {
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
