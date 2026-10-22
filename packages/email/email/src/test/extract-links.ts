import type { EmailOptions } from "../types";

const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const BARE_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const ENTITY_PATTERN = /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi;
const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: "\"" };
const MAX_CODE_POINT = 0x10_ff_ff;
const TRAILING_PUNCTUATION = ".,;:!?)]";

/**
 * Decodes the character entities that can appear in an encoded URL. Decoding is a single pass,
 * so text produced by one decoded entity is never decoded again. Template engines such as
 * Handlebars encode an equals sign as a hexadecimal numeric entity inside attributes.
 * @param value The raw attribute or text value.
 * @returns The value with the supported entities decoded.
 */
const decodeEntities = (value: string): string =>
    value.replaceAll(ENTITY_PATTERN, (entity: string, body: string) => {
        if (!body.startsWith("#")) {
            return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
        }

        const code = body.charAt(1).toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));

        return code <= MAX_CODE_POINT ? String.fromCodePoint(code) : entity;
    });

/**
 * Drops sentence punctuation that follows a bare URL in prose. A loop rather than a regex, so a
 * long run of punctuation cannot cause backtracking.
 * @param url The candidate URL.
 * @returns The URL without trailing punctuation.
 */
const stripTrailingPunctuation = (url: string): string => {
    let end = url.length;

    while (end > 0 && TRAILING_PUNCTUATION.includes(url.charAt(end - 1))) {
        end -= 1;
    }

    return url.slice(0, end);
};

/**
 * Replaces markup with spaces, leaving the visible text. A loop rather than a regex, so
 * unbalanced angle brackets cannot cause backtracking.
 * @param html The HTML source.
 * @returns The HTML with every tag replaced by a space.
 */
const stripTags = (html: string): string => {
    let text = "";
    let inTag = false;

    for (const char of html) {
        if (char === "<") {
            inTag = true;
            text += " ";
        } else if (char === ">" && inTag) {
            inTag = false;
        } else if (!inTag) {
            text += char;
        }
    }

    return text;
};

/**
 * Adds every bare http(s) URL in a body of visible text to `links`.
 * @param links The set the URLs are added to.
 * @param body Text with no markup.
 */
const collectBareUrls = (links: Set<string>, body: string): void => {
    for (const match of body.matchAll(BARE_URL_PATTERN)) {
        links.add(stripTrailingPunctuation(match[0]));
    }
};

/**
 * Returns the http(s) URLs in a message without duplicates, in this order: `href` targets in the
 * HTML, bare URLs in the visible text of the HTML, then bare URLs in the plain text.
 *
 * Image sources, tracking pixels and CSS `url()` values are not links, so they are not returned.
 * Entities are decoded in HTML only. Only absolute http and https URLs are returned.
 * @param source A plain-text string, or an object with the message's `html` and/or `text`. Pass
 * markup as `{ html }`; a bare string is always treated as plain text.
 * @returns The matching URLs.
 * @example
 * ```ts
 * const [verifyUrl] = extractLinks(email.sent()[0]!.options);
 * ```
 */
export const extractLinks = (source: string | Pick<EmailOptions, "html" | "text">): string[] => {
    const { html, text } = typeof source === "string" ? { text: source } : source;
    const links = new Set<string>();

    if (html !== undefined) {
        for (const match of html.matchAll(HREF_PATTERN)) {
            links.add(decodeEntities(match[1] ?? match[2] ?? ""));
        }

        collectBareUrls(links, decodeEntities(stripTags(html)));
    }

    if (text !== undefined) {
        collectBareUrls(links, text);
    }

    return [...links].filter((link) => {
        try {
            const { protocol } = new URL(link);

            return protocol === "http:" || protocol === "https:";
        } catch {
            return false;
        }
    });
};

export default extractLinks;
