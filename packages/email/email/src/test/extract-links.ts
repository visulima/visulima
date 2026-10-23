import type { EmailOptions } from "../types";

const HREF_ATTRIBUTE_PATTERN = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const TAG_NAME_PATTERN = /^\/?([a-z][\da-z]*)/i;
const BARE_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const ENTITY_PATTERN = /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi;
const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: "\"" };
const LINK_ELEMENTS = new Set(["a", "area"]);
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);
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
 * What a single pass over an HTML body finds.
 */
interface HtmlScan {
    /**
     * Raw `href` values of `a` and `area` elements, in document order.
     */
    hrefs: string[];

    /**
     * The text a reader sees: markup, comments, and the contents of `script` and `style` removed.
     */
    visibleText: string;
}

/**
 * Returns the raw `href` value of a tag's attributes, or `undefined` when there is none.
 * @param tag The text between `&lt;` and `>`.
 * @returns The attribute value, still entity-encoded.
 */
const readHref = (tag: string): string | undefined => {
    const match = HREF_ATTRIBUTE_PATTERN.exec(tag);

    return match ? match[1] ?? match[2] ?? "" : undefined;
};

/**
 * Returns the index just past an HTML comment that starts at `open`.
 * @param html The HTML source.
 * @param open The index of the `&lt;` that starts the comment.
 * @returns The index to resume scanning from.
 */
const skipComment = (html: string, open: number): number => {
    const commentEnd = html.indexOf("-->", open + 4);

    return commentEnd === -1 ? html.length : commentEnd + 3;
};

/**
 * Returns the index just past the closing tag of a raw-text element such as `script`.
 * @param lower The lower-cased HTML source, used so the closing tag matches in any case.
 * @param name The element name, lower-cased.
 * @param from The index the element's contents start at.
 * @returns The index to resume scanning from.
 */
const skipRawText = (lower: string, name: string, from: number): number => {
    const end = lower.indexOf(`</${name}`, from);
    const endClose = end === -1 ? -1 : lower.indexOf(">", end);

    return endClose === -1 ? lower.length : endClose + 1;
};

/**
 * Walks the HTML tag by tag. Only `a` and `area` elements carry links, so the `href` of a `link`
 * or `base` element is ignored. The contents of `script` and `style` and HTML comments are never
 * shown to a reader, so a URL inside them is ignored too.
 * @param html The HTML source.
 * @returns The anchor hrefs and the visible text.
 */
const scanHtml = (html: string): HtmlScan => {
    const lower = html.toLowerCase();
    const hrefs: string[] = [];
    let visibleText = "";
    let cursor = 0;

    while (cursor < html.length) {
        const open = html.indexOf("<", cursor);

        if (open === -1) {
            visibleText += html.slice(cursor);

            break;
        }

        visibleText += `${html.slice(cursor, open)} `;

        if (html.startsWith("<!--", open)) {
            cursor = skipComment(html, open);

            continue;
        }

        const close = html.indexOf(">", open + 1);

        if (close === -1) {
            break;
        }

        const tag = html.slice(open + 1, close);
        const name = TAG_NAME_PATTERN.exec(tag)?.[1]?.toLowerCase() ?? "";
        const isOpening = !tag.startsWith("/");

        cursor = close + 1;

        const href = isOpening && LINK_ELEMENTS.has(name) ? readHref(tag) : undefined;

        if (href !== undefined) {
            hrefs.push(href);
        }

        if (isOpening && RAW_TEXT_ELEMENTS.has(name)) {
            cursor = skipRawText(lower, name, cursor);
        }
    }

    return { hrefs, visibleText };
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
 * Returns the http(s) URLs in a message without duplicates, in this order: `href` targets of
 * anchor and area elements in the HTML, bare URLs in the visible HTML text, then bare URLs in the
 * plain text.
 *
 * Images, `link` and `base` elements, `script` and `style` contents, comments, and CSS `url()`
 * values are not links, so they are not returned. Entities are decoded in HTML only. Only absolute
 * http and https URLs are returned.
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
        const { hrefs, visibleText } = scanHtml(html);

        for (const href of hrefs) {
            links.add(decodeEntities(href));
        }

        collectBareUrls(links, decodeEntities(visibleText));
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
