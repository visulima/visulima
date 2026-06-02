/**
 * Options for {@link buildListUnsubscribe}.
 */
export interface ListUnsubscribeOptions {
    /**
     * A `mailto:` target the recipient can email to unsubscribe.
     *
     * Provide a bare address (`unsub@example.com`) or a full `mailto:` URI with query parameters.
     */
    mailto?: string;

    /**
     * The default `subject` to attach to a bare `mailto` address.
     * @default "unsubscribe"
     */
    mailtoSubject?: string;

    /**
     * Enable [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058) one-click unsubscribe.
     *
     * Requires {@link ListUnsubscribeOptions.url} to be an `https:` endpoint that accepts a POST with
     * the body `List-Unsubscribe=One-Click`.
     * @default false
     */
    oneClick?: boolean;

    /**
     * An `https:` URL the recipient (or their mail client) can use to unsubscribe.
     */
    url?: string;
}

/**
 * The headers produced by {@link buildListUnsubscribe}.
 */
export interface ListUnsubscribeHeaders {
    "List-Unsubscribe": string;
    "List-Unsubscribe-Post"?: string;
}

/**
 * Builds `List-Unsubscribe` (and, when requested, `List-Unsubscribe-Post`) headers.
 *
 * Gmail and Yahoo's 2024 bulk-sender requirements expect bulk senders to expose a one-click
 * unsubscribe. Pass an `https:` {@link ListUnsubscribeOptions.url} with `oneClick: true` to emit the
 * RFC 8058 `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header alongside it.
 * @param options At least one of `url` or `mailto` must be provided. See {@link ListUnsubscribeOptions}.
 * @returns The header record to merge into an email's headers.
 * @throws {TypeError} When neither `url` nor `mailto` is provided, or `oneClick` is set without an `https:` url.
 * @example
 * ```ts
 * const headers = buildListUnsubscribe({
 *   url: "https://example.com/unsub?id=abc",
 *   mailto: "unsubscribe@example.com",
 *   oneClick: true,
 * });
 * // {
 * //   "List-Unsubscribe": "<https://example.com/unsub?id=abc>, <mailto:unsubscribe@example.com?subject=unsubscribe>",
 * //   "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
 * // }
 * ```
 */
export const buildListUnsubscribe = (options: ListUnsubscribeOptions): ListUnsubscribeHeaders => {
    const { mailto, mailtoSubject = "unsubscribe", oneClick = false, url } = options;

    if (!url && !mailto) {
        throw new TypeError("buildListUnsubscribe requires at least one of `url` or `mailto`");
    }

    const targets: string[] = [];

    if (url) {
        targets.push(`<${url}>`);
    }

    if (mailto) {
        if (mailto.startsWith("mailto:")) {
            targets.push(`<${mailto}>`);
        } else {
            targets.push(`<mailto:${mailto}?subject=${encodeURIComponent(mailtoSubject)}>`);
        }
    }

    const headers: ListUnsubscribeHeaders = {
        "List-Unsubscribe": targets.join(", "),
    };

    if (oneClick) {
        if (!url?.startsWith("https:")) {
            throw new TypeError("One-click unsubscribe (RFC 8058) requires an https `url`");
        }

        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    return headers;
};

/**
 * Parses a `List-Unsubscribe` header value into its individual targets.
 * @param header The raw `List-Unsubscribe` header value containing angle-bracketed targets.
 * @returns The list of unwrapped targets (URLs / mailto URIs).
 */
export const parseListUnsubscribe = (header: string): string[] => {
    // Anchored, linear pattern — safe from catastrophic backtracking.
    // eslint-disable-next-line sonarjs/slow-regex
    const matches = header.match(/<[^>]+>/g);

    if (!matches) {
        return [];
    }

    return matches.map((match) => match.slice(1, -1).trim());
};
