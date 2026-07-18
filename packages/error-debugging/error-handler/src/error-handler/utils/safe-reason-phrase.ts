import { getReasonPhrase } from "http-status-codes";

/**
 * Resolve the reason phrase for a status code without throwing. `getReasonPhrase`
 * throws ("Status code does not exist") for in-range but unassigned codes (e.g.
 * 460, 599 from a proxy/upstream), which would crash the formatter while it is
 * already handling an error. Fall back to the provided phrase instead.
 * @param statusCode HTTP status code
 * @param fallback phrase used when the status code has no assigned reason phrase
 */
const safeReasonPhrase = (statusCode: number, fallback: string = "An error occurred"): string => {
    try {
        return getReasonPhrase(statusCode);
    } catch {
        return fallback;
    }
};

export default safeReasonPhrase;
