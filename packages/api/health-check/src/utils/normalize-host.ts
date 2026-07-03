/**
 * Normalizes a user-supplied host string to a bare hostname suitable for DNS
 * resolution or `ping`.
 *
 * If the input looks like a URL (has a scheme), it is parsed via {@link URL} so
 * the protocol, port, path, query and credentials are stripped — e.g.
 * `"https://example.com:8080/path"` becomes `"example.com"`. Otherwise the
 * input is returned unchanged (after a best-effort protocol strip for inputs
 * that start with a scheme but are not valid URLs).
 * @param host A hostname, domain, or URL.
 * @returns The bare hostname.
 */
const normalizeHost = (host: string): string => {
    if (/^[a-z][\w+.-]*:\/\//i.test(host)) {
        try {
            return new URL(host).hostname;
        } catch {
            // Fall through to the regex-based strip below for malformed URLs.
        }
    }

    return host.replace(/^[a-z][\w+.-]*:\/\//i, "");
};

export default normalizeHost;
