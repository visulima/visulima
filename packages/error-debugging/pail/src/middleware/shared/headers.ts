/**
 * Headers that should be excluded from logging for security reasons.
 */
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "proxy-authorization", "set-cookie", "x-api-key", "x-auth-token"]);

/**
 * Extract safe headers from a Web API Headers object, filtering out
 * sensitive headers like Authorization, Cookie, and API keys.
 * @param headers Web API Headers object
 * @returns Plain object of safe header key-value pairs
 */
export const extractSafeHeaders = (headers: Headers): Record<string, string> => {
    const safe: Record<string, string> = {};

    headers.forEach((value, key) => {
        if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
            safe[key.toLowerCase()] = value;
        }
    });

    return safe;
};

/**
 * Extract safe headers from a Node.js IncomingHttpHeaders object,
 * filtering out sensitive headers.
 * @param headers Node.js IncomingHttpHeaders-like object
 * @returns Plain object of safe header key-value pairs
 */
export const extractSafeNodeHeaders = (headers: Record<string, string | string[] | undefined>): Record<string, string> => {
    const safe: Record<string, string> = {};

    const entries: [string, string | string[] | undefined][] = Object.entries(headers);

    for (let i = 0; i < entries.length; i += 1) {
        const [key, value] = entries[i];

        if (!SENSITIVE_HEADERS.has(key.toLowerCase()) && value !== undefined) {
            safe[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
        }
    }

    return safe;
};
