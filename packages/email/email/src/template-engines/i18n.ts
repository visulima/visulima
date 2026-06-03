import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * A map of locale code (e.g. `en`, `en-US`, `de`) to that locale's template.
 *
 * The template value is whatever the underlying {@link TemplateRenderer} accepts (a string for
 * Handlebars/MJML/Liquid, a component for react-email/jsx-email, etc.).
 */
export type LocaleTemplates = Record<string, unknown>;

/**
 * Options for {@link renderI18n} and {@link createI18nRenderer}.
 */
export interface I18nRenderOptions {
    /**
     * Locale to fall back to when the requested locale (and its language root) is missing.
     */
    defaultLocale?: string;

    /**
     * Options forwarded to the underlying renderer.
     */
    rendererOptions?: Record<string, unknown>;
}

/**
 * Resolves the best-matching available locale key: exact match, then the language subtag
 * (`en-US` → `en`), then the default locale.
 * @param templates The available locale templates.
 * @param locale The requested locale.
 * @param defaultLocale Optional fallback locale.
 * @returns The matching key, or `undefined` when nothing matches.
 */
export const resolveLocale = (templates: LocaleTemplates, locale: string, defaultLocale?: string): string | undefined => {
    // Locale tags are case-insensitive (BCP 47), so match against a lower-cased view of the keys and
    // return the original key so the template lookup stays exact.
    const byLowerKey = new Map(Object.keys(templates).map((key) => [key.toLowerCase(), key]));
    const lookup = (candidate: string | undefined): string | undefined => {
        if (candidate === undefined) {
            return undefined;
        }

        return byLowerKey.get(candidate.toLowerCase());
    };

    return lookup(locale) ?? lookup(locale.split("-")[0]) ?? lookup(defaultLocale);
};

/**
 * Renders the template for a given locale using the supplied engine, with locale fallback.
 * @param templates The per-locale templates. See {@link LocaleTemplates}.
 * @param locale The requested locale (e.g. `de-AT`).
 * @param renderer The underlying template engine (Handlebars, MJML, Liquid, react-email, …).
 * @param data Data/variables passed to the renderer.
 * @param options Fallback locale and renderer options. See {@link I18nRenderOptions}.
 * @returns The rendered output for the resolved locale.
 * @throws {EmailError} When no template matches the locale or the fallback.
 */
export const renderI18n = async (
    templates: LocaleTemplates,
    locale: string,
    renderer: TemplateRenderer,
    data?: Record<string, unknown>,
    options?: I18nRenderOptions,
): Promise<string> => {
    const resolved = resolveLocale(templates, locale, options?.defaultLocale);

    if (resolved === undefined) {
        throw new EmailError("i18n", `No template found for locale "${locale}"${options?.defaultLocale ? ` or default "${options.defaultLocale}"` : ""}`);
    }

    return await renderer(templates[resolved], data, options?.rendererOptions);
};

/**
 * A locale-resolving renderer produced by {@link createI18nRenderer}.
 */
export type LocalizedRenderer = (
    templates: LocaleTemplates,
    locale: string,
    data?: Record<string, unknown>,
    rendererOptions?: Record<string, unknown>,
) => Promise<string>;

/**
 * Creates a reusable localized renderer bound to an engine and default locale.
 * @param renderer The underlying template engine.
 * @param defaultLocale Optional default/fallback locale applied to every call.
 * @returns A {@link LocalizedRenderer}.
 * @example
 * ```ts
 * import { renderHandlebars } from "@visulima/email/template/handlebars";
 * import { createI18nRenderer } from "@visulima/email/template/i18n";
 *
 * const render = createI18nRenderer(renderHandlebars, "en");
 * await render({ en: "Hello {{name}}", de: "Hallo {{name}}" }, "de", { name: "Ada" });
 * ```
 */
export const createI18nRenderer = (renderer: TemplateRenderer, defaultLocale?: string): LocalizedRenderer =>
    (templates, locale, data, rendererOptions) => renderI18n(templates, locale, renderer, data, { defaultLocale, rendererOptions });
