const BODY_OPEN = /<body[^>]*>/i;

const escapeHtml = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");

/**
 * Options for {@link injectPreheader}.
 */
export interface PreheaderOptions {
    /**
     * Append invisible padding characters so the preheader text isn't followed by leaked body content
     * in the inbox preview.
     * @default true
     */
    spacer?: boolean;
}

/**
 * Injects a hidden preheader (inbox preview text) at the start of the HTML body.
 *
 * The preheader is wrapped in a `display:none` element with `mso-hide:all`, followed by zero-width
 * padding so the preview shows only your text. Inserted right after `&lt;body>` (or prepended if no
 * body tag is present).
 * @param html The HTML email.
 * @param preheader The preview text.
 * @param options Injection options. See {@link PreheaderOptions}.
 * @returns The HTML with the preheader injected.
 */
export const injectPreheader = (html: string, preheader: string, options: PreheaderOptions = {}): string => {
    const padding = options.spacer === false ? "" : "‌ ".repeat(120);
    const block = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${padding}</div>`;

    const match = BODY_OPEN.exec(html);

    if (match) {
        const index = match.index + match[0].length;

        return `${html.slice(0, index)}${block}${html.slice(index)}`;
    }

    return `${block}${html}`;
};
