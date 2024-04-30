import type { Options as CssNanoOptions } from "cssnano";
import type * as postcss from "postcss";

import type { LESSLoaderOptions } from "./loaders/less";
import type { ImportOptions } from "./loaders/postcss/import";
import type { ModulesOptions } from "./loaders/postcss/modules";
import type { UrlOptions } from "./loaders/postcss/url";
import type { SASSLoaderOptions } from "./loaders/sass";
import type { StylusLoaderOptions } from "./loaders/stylus";
import type { Loader,SourceMapOptions } from "./loaders/types";

/** Options for PostCSS config loader */
export interface PostCSSConfigLoaderOptions {
    /**
     * Context object passed to PostCSS config file
     * @default {}
     */
    ctx?: Record<string, unknown>;
    /** Path to PostCSS config file directory */
    path?: string;
}

/** Options for PostCSS loader */
export interface PostCSSLoaderOptions extends Record<string, unknown> {
    /** @see {@link Options.autoModules} */
    autoModules: NonNullable<Options["autoModules"]>;
    /** @see {@link Options.config} */
    config: Exclude<Options["config"], true | undefined>;
    /** @see {@link Options.dts} */
    dts: NonNullable<Options["dts"]>;
    /** @see {@link Options.mode} */
    emit: boolean;
    /** @see {@link Options.extensions} */
    extensions: NonNullable<Options["extensions"]>;

    /** @see {@link Options.mode} */
    extract: boolean | string;
    /** @see {@link Options.import} */
    import: Exclude<Options["import"], true | undefined>;
    /** @see {@link Options.mode} */
    inject: InjectOptions | boolean | ((varname: string, id: string) => string);

    /** @see {@link Options.minimize} */
    minimize: Exclude<Options["minimize"], true | undefined>;
    /** @see {@link Options.modules} */
    modules: Exclude<Options["modules"], true | undefined>;
    /** @see {@link Options.namedExports} */
    namedExports: NonNullable<Options["namedExports"]>;
    /** Options for PostCSS processor */
    postcss: {
        /** @see {@link Options.parser} */
        parser?: postcss.Parser;
        /** @see {@link Options.plugins} */
        plugins?: postcss.AcceptedPlugin[];
        /** @see {@link Options.stringifier} */
        stringifier?: postcss.Stringifier;
        /** @see {@link Options.syntax} */
        syntax?: postcss.Syntax;
    };
    /** @see {@link Options.to} */
    to: Options["to"];

    /** @see {@link Options.url} */
    url: Exclude<Options["url"], true | undefined>;
}

/** CSS data for extraction */
export interface ExtractedData {
    /** CSS */
    css: string;
    /** Sourcemap */
    map?: string;
    /** Output name for CSS */
    name: string;
}

/** Options for CSS injection */
export interface InjectOptions {
    /**
     * Set attributes of injected `<style>` tag(s)
     * - ex.: `{"id":"global"}`
     */
    attributes?: Record<string, string>;
    /**
     * Container for `<style>` tag(s) injection
     * @default "head"
     */
    container?: string;
    /**
     * Insert `<style>` tag(s) to the beginning of the container
     * @default false
     */
    prepend?: boolean;
    /**
     * Inject CSS into single `<style>` tag only
     * @default false
     */
    singleTag?: boolean;
    /**
     * Makes injector treeshakeable,
     * as it is only called when either classes are referenced directly,
     * or `inject` function is called from the default export.
     *
     * Incompatible with `namedExports` option.
     */
    treeshakeable?: boolean;
}

/** `rollup-plugin-styles`'s full option list */
export interface Options {
    /**
     * Aliases for URL and import paths
     * - ex.: `{"foo":"bar"}`
     */
    alias?: Record<string, string>;
    /**
     * Automatically enable
     * [CSS Modules](https://github.com/css-modules/css-modules)
     * for files named `[name].module.[ext]`
     * (e.g. `foo.module.css`, `bar.module.stylus`),
     * or pass your own function or regular expression
     * @default false
     */
    autoModules?: RegExp | boolean | ((id: string) => boolean);
    /**
     * Enable/disable or pass options for PostCSS config loader
     * @default true
     */
    config?: PostCSSConfigLoaderOptions | boolean;
    /**
     * Generate TypeScript declarations files for input style files
     * @default false
     */
    dts?: boolean;
    /** Files to exclude from processing */
    exclude?: ReadonlyArray<RegExp | string> | RegExp | string | null;
    /**
     * PostCSS will process files ending with these extensions
     * @default [".css", ".pcss", ".postcss", ".sss"]
     */
    extensions?: string[];
    /**
     * Enable/disable or pass options for CSS `@import` resolver
     * @default true
     */
    import?: ImportOptions | boolean;
    /** Files to include for processing */
    include?: ReadonlyArray<RegExp | string> | RegExp | string | null;
    /** Options for Less loader */
    less?: LESSLoaderOptions;
    /** Array of custom loaders */
    loaders?: Loader[];
    /**
     * Enable/disable or pass options for
     * [cssnano](https://github.com/cssnano/cssnano)
     * @default false
     */
    minimize?: CssNanoOptions | boolean;
    /**
     * Select mode for this plugin:
     * - `"inject"` *(default)* - Embeds CSS inside JS and injects it into `<head>` at runtime.
     * You can also pass options for CSS injection.
     * Alternatively, you can pass your own CSS injector.
     * - `"extract"` - Extract CSS to the same location where JS file is generated but with `.css` extension.
     * You can also set extraction path manually,
     * relative to output dir/output file's basedir,
     * but not outside of it.
     * - `"emit"` - Emit pure processed CSS and pass it along the build pipeline.
     * Useful if you want to preprocess CSS before using it with CSS consuming plugins.
     * @default "inject"
     */
    mode?:
        "emit" | "extract" | "inject" | ["emit"] | ["extract", string] | ["extract"] | ["inject", InjectOptions | ((varname: string, id: string) => string)] | ["inject"];
    /**
     * Enable/disable or pass options for
     * [CSS Modules](https://github.com/css-modules/css-modules)
     * @default false
     */
    modules?: ModulesOptions | boolean;
    /**
     * Use named exports alongside default export.
     * You can pass a function to control how exported name is generated.
     * @default false
     */
    namedExports?: boolean | ((name: string) => string);
    /**
     * Function which is invoked on CSS file extraction.
     * Return `boolean` to control if file should be extracted or not.
     */
    onExtract?: (data: ExtractedData) => boolean;
    /**
     * Function which is invoked on CSS file import,
     * before any transformations are applied
     */
    onImport?: (code: string, id: string) => void;
    /**
     * Set PostCSS parser, e.g. `sugarss`.
     * Overrides the one loaded from PostCSS config file, if any.
     */
    parser?: postcss.Parser | string;
    /**
     * A list of plugins for PostCSS,
     * which are used before plugins loaded from PostCSS config file, if any
     */
    plugins?:
        (
              postcss.AcceptedPlugin | string | [postcss.PluginCreator<unknown> | string, Record<string, unknown>] | [postcss.PluginCreator<unknown> | string] | null | undefined
          )[] | Record<string, unknown>;
    /** Options for Sass loader */
    sass?: SASSLoaderOptions;
    /**
     * Enable/disable or configure sourcemaps
     * @default false
     */
    sourceMap?: boolean | "inline" | [boolean | "inline", SourceMapOptions] | [boolean | "inline"];
    /**
     * Set PostCSS stringifier.
     * Overrides the one loaded from PostCSS config file, if any.
     */
    stringifier?: postcss.Stringifier | string;
    /** Options for Stylus loader */
    stylus?: StylusLoaderOptions;
    /**
     * Set PostCSS syntax.
     * Overrides the one loaded from PostCSS config file, if any.
     */
    syntax?: postcss.Syntax | string;
    /** `to` option for PostCSS, required for some plugins */
    to?: string;
    /**
     * Enable/disable or pass options for CSS URL resolver
     * @default true
     */
    url?: UrlOptions | boolean;
    /**
     * Array of loaders to use, executed from right to left.
     * Currently built-in loaders are:
     * - `sass` (Supports `.scss` and `.sass` files)
     * - `less` (Supports `.less` files)
     * - `stylus` (Supports `.styl` and `.stylus` files)
     * @default ["sass", "less", "stylus"]
     */
    use?: string[];
}
