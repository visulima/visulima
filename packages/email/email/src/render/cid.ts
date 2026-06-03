// Matches src="cid:foo" / href = 'cid:bar' (attribute, optional whitespace around "=", quote, token).
const CID_ATTRIBUTE = /\b(src|href)\s*=\s*(["'])cid:([^"']+)\2/gi;

/**
 * Rewrites `cid:` references in `src`/`href` attributes using a resolver.
 *
 * Useful for turning inline (Content-ID) image references into hosted URLs for previews/webmail, or
 * for normalizing them. Returning `undefined` from the resolver leaves that reference unchanged.
 * @param html The HTML email.
 * @param resolver Maps a Content-ID to a replacement URL (or `undefined` to keep it).
 * @returns The rewritten HTML.
 */
export const rewriteCidLinks = (html: string, resolver: (cid: string) => string | undefined): string =>
    html.replaceAll(CID_ATTRIBUTE, (match: string, attribute: string, quote: string, cid: string): string => {
        const url = resolver(cid);

        return url === undefined ? match : `${attribute}=${quote}${url}${quote}`;
    });

/**
 * Collects the Content-IDs referenced via `cid:` in `src`/`href` attributes.
 * @param html The HTML email.
 * @returns The referenced Content-IDs (de-duplicated, in first-seen order).
 */
export const extractCidReferences = (html: string): string[] => {
    const seen = new Set<string>();

    for (const match of html.matchAll(CID_ATTRIBUTE)) {
        if (match[3]) {
            seen.add(match[3]);
        }
    }

    return [...seen];
};
