import type { FilePart } from "../utils/file";
import { hasContent } from "../utils/file";
import GCSFile from "./gcs-file";
import { GaxiosError, RetryConfig } from "gaxios";

export function getRangeEnd(range: string): number {
    const end = +(range.split(/0-/)[1] as string);

    return end > 0 ? end + 1 : 0;
}

export function buildContentRange(part: Partial<FilePart> & GCSFile): string {
    if (hasContent(part)) {
        const end = part.contentLength ? part.start + part.contentLength - 1 : "*";
        return `bytes ${part.start}-${end}/${part.size ?? "*"}`;
    }
    return `bytes */${part.size ?? "*"}`;
}

export function shouldRetry(error: GaxiosError) {
    if (typeof error.response !== "undefined") {
        const { response } = error;

        return response?.data?.error?.errors
            ?.map(({ reason = "" }) => {
                if (reason === "rateLimitExceeded") {
                    return true;
                }

                if (reason === "userRateLimitExceeded") {
                    return true;
                }

                return !!(reason && reason.includes("EAI_AGAIN"));
            })
            .includes(true);
    }

    return false;
}

export const retryOptions: RetryConfig = {
    retry: 3,
    statusCodesToRetry: [[408, 429, 500, 502, 503, 504], [100, 199], [429], [500, 599]],
    shouldRetry,
};
