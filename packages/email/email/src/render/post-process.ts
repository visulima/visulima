import { rewriteCidLinks } from "./cid";
import inlineCss from "./css-inline";
import type { DarkModeOptions } from "./dark-mode";
import { addDarkModeSupport } from "./dark-mode";
import type { PreheaderOptions } from "./preheader";
import { injectPreheader } from "./preheader";

/**
 * Options for {@link postProcessHtml}. Each step runs only when its option is set; the order is
 * CSS-inline → preheader → dark-mode → CID rewrite.
 */
export interface PostProcessOptions {
    /**
     * Rewrite `cid:` references using this resolver (see {@link rewriteCidLinks}).
     */
    cidResolver?: (cid: string) => string | undefined;

    /**
     * Add dark-mode hooks. `true` adds the meta tags only; an object also injects dark CSS.
     */
    darkMode?: DarkModeOptions | boolean;

    /**
     * Inline CSS via `juice`. `true` uses defaults; an object forwards options to `juice`.
     */
    inlineCss?: Record<string, unknown> | boolean;

    /**
     * Inject hidden preview text at the top of the body.
     */
    preheader?: string;

    /**
     * Options for the preheader injection.
     */
    preheaderOptions?: PreheaderOptions;
}

/**
 * Runs an HTML email through the selected post-processing steps.
 *
 * A convenience pipeline over {@link inlineCss}, {@link injectPreheader}, {@link addDarkModeSupport} and
 * {@link rewriteCidLinks}. Only the steps whose options are provided run.
 * @param html The HTML email.
 * @param options Which steps to apply. See {@link PostProcessOptions}.
 * @returns The processed HTML.
 */
export const postProcessHtml = (html: string, options: PostProcessOptions = {}): string => {
    let result = html;

    if (options.inlineCss) {
        result = inlineCss(result, typeof options.inlineCss === "object" ? options.inlineCss : undefined);
    }

    if (options.preheader !== undefined) {
        result = injectPreheader(result, options.preheader, options.preheaderOptions);
    }

    if (options.darkMode) {
        result = addDarkModeSupport(result, typeof options.darkMode === "object" ? options.darkMode : undefined);
    }

    if (options.cidResolver) {
        result = rewriteCidLinks(result, options.cidResolver);
    }

    return result;
};
