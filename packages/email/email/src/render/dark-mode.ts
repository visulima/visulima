const HEAD_OPEN = /<head[^>]*>/i;
const HTML_OPEN = /<html[^>]*>/i;

/**
 * Options for {@link addDarkModeSupport}.
 */
export interface DarkModeOptions {
    /**
     * Extra CSS to wrap in a `@media (prefers-color-scheme: dark)` block (the dark-mode overrides).
     */
    styles?: string;
}

/**
 * Adds dark-mode hooks to an HTML email: the `color-scheme` / `supported-color-schemes` meta tags and,
 * when provided, a `@media (prefers-color-scheme: dark)` style block.
 *
 * Injected into `&lt;head>` (created after `&lt;html>` if absent, otherwise prepended).
 * @param html The HTML email.
 * @param options Dark-mode options. See {@link DarkModeOptions}.
 * @returns The HTML with dark-mode support added.
 */
export const addDarkModeSupport = (html: string, options: DarkModeOptions = {}): string => {
    const meta = "<meta name=\"color-scheme\" content=\"light dark\"><meta name=\"supported-color-schemes\" content=\"light dark\">";
    const styleBlock = options.styles ? `<style>@media (prefers-color-scheme: dark){${options.styles}}</style>` : "";
    const injection = `${meta}${styleBlock}`;

    const headMatch = HEAD_OPEN.exec(html);

    if (headMatch) {
        const index = headMatch.index + headMatch[0].length;

        return `${html.slice(0, index)}${injection}${html.slice(index)}`;
    }

    const htmlMatch = HTML_OPEN.exec(html);

    if (htmlMatch) {
        const index = htmlMatch.index + htmlMatch[0].length;

        return `${html.slice(0, index)}<head>${injection}</head>${html.slice(index)}`;
    }

    return `<head>${injection}</head>${html}`;
};
