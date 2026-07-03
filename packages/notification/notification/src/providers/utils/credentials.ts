/**
 * Builds an HTTP Basic auth header value. Edge-safe — uses `btoa` (global in Node 18+
 * and all edge runtimes) rather than `Buffer`.
 * @param username The Basic-auth username (e.g. an account SID or API key id).
 * @param password The Basic-auth password / secret paired with the username.
 * @returns The `Basic &lt;base64>` header value.
 */
export const basicAuth = (username: string, password: string): string => `Basic ${btoa(`${username}:${password}`)}`;

/**
 * Normalises a recipient field to an array.
 * @param to A single recipient or array of recipients.
 * @returns A recipient array.
 */
export const toRecipientList = (to: string | string[]): string[] => {
    if (Array.isArray(to)) {
        return to;
    }

    return [to];
};
