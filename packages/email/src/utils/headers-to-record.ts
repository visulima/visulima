import type { EmailHeaders } from "../types";

/**
 * Converts EmailHeaders (Record&lt;string, string> or ImmutableHeaders) to Record&lt;string, string>
 * This allows us to work with headers uniformly regardless of their input type
 * @param headers The headers to convert (Record or ImmutableHeaders)
 * @returns A plain object Record&lt;string, string> representation of the headers
 */
const headersToRecord = (headers: EmailHeaders): Record<string, string> => {
    // If it's already a plain object, return it
    if (!(headers instanceof Headers)) {
        return headers;
    }

    // Convert Headers instance to plain object
    const record: Record<string, string> = {};

    headers.forEach((value, key) => {
        record[key] = value;
    });

    return record;
};

export default headersToRecord;
