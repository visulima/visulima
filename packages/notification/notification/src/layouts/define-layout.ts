import { renderString } from "../template-engines/string";
import type { TemplateRenderer } from "../template-engines/types";

/** Options for {@link defineLayout}. */
interface LayoutOptions {
    /**
     * The renderer used for the layout template. Defaults to the zero-dependency
     * `renderString` (`{{var}}`); pass the Handlebars/Liquid renderer for logic.
     */
    render?: TemplateRenderer;

    /** Name of the slot variable the content is injected as. Defaults to `"content"`. */
    slot?: string;

    /**
     * The layout template. Must contain the slot placeholder (default `{{content}}`).
     * With the Handlebars renderer use the unescaped `{{{content}}}` so the already-
     * rendered HTML body is not double-escaped.
     */
    template: string;
}

/** A reusable layout: renders a content string into its slot, then renders the wrapper. */
interface Layout {
    /**
     * Wrap `content` in the layout.
     * @param content The already-rendered body to inject into the slot.
     * @param variables Extra variables available to the layout template (e.g. `unsubscribeUrl`).
     */
    render: (content: string, variables?: Record<string, unknown>) => Promise<string>;
}

/**
 * Define a reusable content layout — shared chrome (header/footer/brand) with a
 * `{{content}}` slot the per-notification body drops into. Code-first and engine-
 * agnostic: it reuses the package's template renderers, so it stays edge-safe with
 * the default `renderString`.
 * @param options The layout template, optional renderer and slot name.
 * @returns A {@link Layout} whose `render(content, vars)` returns the wrapped string.
 * @example
 * ```ts
 * const branded = defineLayout({
 *     template: `<table><tr><td>{{content}}</td></tr><tr><td><a href="{{unsubscribeUrl}}">unsubscribe</a></td></tr></table>`,
 * });
 *
 * const html = await branded.render("<p>Welcome!</p>", { unsubscribeUrl: "https://app/u/123" });
 * await notify.sendToChannel("email", { from, to, subject: "Hi", html });
 * ```
 */
const defineLayout = (options: LayoutOptions): Layout => {
    const renderer = options.render ?? renderString;
    const slot = options.slot ?? "content";

    return {
        render: async (content: string, variables: Record<string, unknown> = {}): Promise<string> =>
            renderer(options.template, { ...variables, [slot]: content }),
    };
};

export type { Layout, LayoutOptions };
export default defineLayout;
