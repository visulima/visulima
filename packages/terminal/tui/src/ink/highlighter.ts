/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, promise/always-return */

/**
 * Singleton Shiki highlighter for terminal syntax highlighting.
 *
 * Uses codeToTokens() to produce ThemedToken[][] which are mapped
 * to Ink React elements by token-to-elements.tsx.
 */
import type { Highlighter, LanguageInput, TokensResult } from "shiki";

/**
 * Maps language names to their corresponding Shiki language dynamic imports.
 */
const LANGUAGE_IMPORT_MAP: Record<string, () => Promise<LanguageInput>> = {
    bash: () => import("@shikijs/langs/bash"),
    c: () => import("@shikijs/langs/c"),
    clojure: () => import("@shikijs/langs/clojure"),
    cpp: () => import("@shikijs/langs/cpp"),
    csharp: () => import("@shikijs/langs/csharp"),
    css: () => import("@shikijs/langs/css"),
    dart: () => import("@shikijs/langs/dart"),
    diff: () => import("@shikijs/langs/diff"),
    dockerfile: () => import("@shikijs/langs/dockerfile"),
    elixir: () => import("@shikijs/langs/elixir"),
    erlang: () => import("@shikijs/langs/erlang"),
    go: () => import("@shikijs/langs/go"),
    graphql: () => import("@shikijs/langs/graphql"),
    groovy: () => import("@shikijs/langs/groovy"),
    haskell: () => import("@shikijs/langs/haskell"),
    html: () => import("@shikijs/langs/html"),
    java: () => import("@shikijs/langs/java"),
    javascript: () => import("@shikijs/langs/javascript"),
    json: () => import("@shikijs/langs/json"),
    jsonc: () => import("@shikijs/langs/jsonc"),
    jsx: () => import("@shikijs/langs/jsx"),
    kotlin: () => import("@shikijs/langs/kotlin"),
    less: () => import("@shikijs/langs/less"),
    lua: () => import("@shikijs/langs/lua"),
    makefile: () => import("@shikijs/langs/makefile"),
    markdown: () => import("@shikijs/langs/markdown"),
    mdx: () => import("@shikijs/langs/mdx"),
    nginx: () => import("@shikijs/langs/nginx"),
    objc: () => import("@shikijs/langs/objc"),
    perl: () => import("@shikijs/langs/perl"),
    php: () => import("@shikijs/langs/php"),
    powershell: () => import("@shikijs/langs/powershell"),
    prisma: () => import("@shikijs/langs/prisma"),
    python: () => import("@shikijs/langs/python"),
    r: () => import("@shikijs/langs/r"),
    ruby: () => import("@shikijs/langs/ruby"),
    rust: () => import("@shikijs/langs/rust"),
    scala: () => import("@shikijs/langs/scala"),
    scss: () => import("@shikijs/langs/scss"),
    shell: () => import("@shikijs/langs/shell"),
    sql: () => import("@shikijs/langs/sql"),
    svelte: () => import("@shikijs/langs/svelte"),
    swift: () => import("@shikijs/langs/swift"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text: () => Promise.resolve({ name: "text", patterns: [], repository: {}, scopeName: "source.text" } as any as LanguageInput),
    toml: () => import("@shikijs/langs/toml"),
    tsx: () => import("@shikijs/langs/tsx"),
    typescript: () => import("@shikijs/langs/typescript"),
    vue: () => import("@shikijs/langs/vue"),
    xml: () => import("@shikijs/langs/xml"),
    yaml: () => import("@shikijs/langs/yaml"),
    zig: () => import("@shikijs/langs/zig"),
};

// Common aliases
const LANGUAGE_ALIASES: Record<string, string> = {
    "c#": "csharp",
    "c++": "cpp",
    docker: "dockerfile",
    gql: "graphql",
    hs: "haskell",
    js: "javascript",
    kt: "kotlin",
    md: "markdown",
    "objective-c": "objc",
    ps1: "powershell",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "bash",
    ts: "typescript",
    yml: "yaml",
    zsh: "bash",
};

/**
 * Maps theme names to their dynamic imports. Themes are loaded on demand.
 */
const THEME_IMPORT_MAP: Record<string, () => Promise<unknown>> = {
    "catppuccin-frappe": () => import("@shikijs/themes/catppuccin-frappe"),
    "catppuccin-latte": () => import("@shikijs/themes/catppuccin-latte"),
    "catppuccin-macchiato": () => import("@shikijs/themes/catppuccin-macchiato"),
    "catppuccin-mocha": () => import("@shikijs/themes/catppuccin-mocha"),
    "dark-plus": () => import("@shikijs/themes/dark-plus"),
    dracula: () => import("@shikijs/themes/dracula"),
    "github-dark": () => import("@shikijs/themes/github-dark"),
    "github-dark-default": () => import("@shikijs/themes/github-dark-default"),
    "github-dark-dimmed": () => import("@shikijs/themes/github-dark-dimmed"),
    "github-light": () => import("@shikijs/themes/github-light"),
    "github-light-default": () => import("@shikijs/themes/github-light-default"),
    "light-plus": () => import("@shikijs/themes/light-plus"),
    "min-dark": () => import("@shikijs/themes/min-dark"),
    "min-light": () => import("@shikijs/themes/min-light"),
    monokai: () => import("@shikijs/themes/monokai"),
    nord: () => import("@shikijs/themes/nord"),
    "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
    "one-light": () => import("@shikijs/themes/one-light"),
    poimandres: () => import("@shikijs/themes/poimandres"),
    "rose-pine": () => import("@shikijs/themes/rose-pine"),
    "rose-pine-dawn": () => import("@shikijs/themes/rose-pine-dawn"),
    "rose-pine-moon": () => import("@shikijs/themes/rose-pine-moon"),
    "slack-dark": () => import("@shikijs/themes/slack-dark"),
    "slack-ochin": () => import("@shikijs/themes/slack-ochin"),
    "solarized-dark": () => import("@shikijs/themes/solarized-dark"),
    "solarized-light": () => import("@shikijs/themes/solarized-light"),
    "tokyo-night": () => import("@shikijs/themes/tokyo-night"),
    "vitesse-dark": () => import("@shikijs/themes/vitesse-dark"),
    "vitesse-light": () => import("@shikijs/themes/vitesse-light"),
};

let highlighterPromise: Promise<Highlighter> | undefined;
const languageLoadPromises = new Map<string, Promise<void>>();
const themeLoadPromises = new Map<string, Promise<void>>();

/**
 * Simple LRU cache for codeToTokens results.
 * Key: `${code}\0${lang}\0${theme}`, Value: TokensResult.
 */
const TOKEN_CACHE_MAX = 50;
const tokenCache = new Map<string, TokensResult>();

const makeTokenCacheKey = (code: string, lang: string, theme: string): string => `${code.length}:${code}\0${lang}\0${theme}`;

/**
 * Get cached tokens or compute and cache them.
 */
export const getCachedTokens = (highlighter: Highlighter, code: string, lang: string, theme: string): TokensResult => {
    const key = makeTokenCacheKey(code, lang, theme);

    if (tokenCache.has(key)) {
        // Move to end (most recently used)
        const value = tokenCache.get(key)!;

        tokenCache.delete(key);
        tokenCache.set(key, value);

        return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = highlighter.codeToTokens(code, { lang: lang as any, theme });

    tokenCache.set(key, result);

    // Evict oldest if over capacity
    if (tokenCache.size > TOKEN_CACHE_MAX) {
        const firstKey = tokenCache.keys().next().value;

        if (firstKey !== undefined) {
            tokenCache.delete(firstKey);
        }
    }

    return result;
};

const createSingletonHighlighter = async (): Promise<Highlighter> => {
    const [coreModule, engineModule] = await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { createHighlighterCore } = coreModule as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { createJavaScriptRegexEngine } = engineModule as any;

    const highlighter: Highlighter = await createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        langs: [],
        themes: [import("@shikijs/themes/github-dark-default")],
    });

    return highlighter;
};

/**
 * Resolve a language name to a canonical name, handling aliases.
 */
export const resolveLanguage = (lang: string): string => {
    const lower = lang.toLowerCase();

    return LANGUAGE_ALIASES[lower] ?? lower;
};

/**
 * Check if a language is supported.
 */
export const isLanguageSupported = (lang: string): boolean => {
    const resolved = resolveLanguage(lang);

    return resolved in LANGUAGE_IMPORT_MAP;
};

/**
 * Ensure a language is loaded into the highlighter.
 */
const ensureLanguageLoaded = async (highlighter: Highlighter, langName: string): Promise<void> => {
    const resolved = resolveLanguage(langName);

    if (resolved === "text") {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadedLanguages: string[] = (highlighter as any).getLoadedLanguages?.() ?? [];

    if (loadedLanguages.includes(resolved)) {
        return;
    }

    // Deduplicate concurrent loads for the same language
    if (!languageLoadPromises.has(resolved)) {
        const promise = (async () => {
            try {
                const importer = LANGUAGE_IMPORT_MAP[resolved];

                if (importer) {
                    await highlighter.loadLanguage(await importer());
                }
            } catch (error) {
                languageLoadPromises.delete(resolved);
                throw error;
            }
        })();

        languageLoadPromises.set(resolved, promise);
    }

    await languageLoadPromises.get(resolved);
};

/**
 * Ensure a theme is loaded into the highlighter.
 */
const ensureThemeLoaded = async (highlighter: Highlighter, themeName: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadedThemes: string[] = (highlighter as any).getLoadedThemes?.() ?? [];

    if (loadedThemes.includes(themeName)) {
        return;
    }

    const importer = THEME_IMPORT_MAP[themeName];

    if (!importer) {
        // Unknown theme — skip silently, Shiki will use its fallback or throw on codeToTokens
        return;
    }

    if (!themeLoadPromises.has(themeName)) {
        const promise = (async () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await highlighter.loadTheme((await importer()) as any);
            } catch (error) {
                themeLoadPromises.delete(themeName);
                throw error;
            }
        })();

        themeLoadPromises.set(themeName, promise);
    }

    await themeLoadPromises.get(themeName);
};

/**
 * Get or create the singleton Shiki highlighter, optionally loading languages and themes.
 */
const getHighlighter = async (languages: string[] = [], theme?: string): Promise<Highlighter> => {
    if (!highlighterPromise) {
        highlighterPromise = createSingletonHighlighter();
    }

    const highlighter = await highlighterPromise;

    const loadPromises: Promise<void>[] = languages.map((lang) => ensureLanguageLoaded(highlighter, lang));

    if (theme && theme !== "github-dark-default") {
        loadPromises.push(ensureThemeLoaded(highlighter, theme));
    }

    await Promise.all(loadPromises);

    return highlighter;
};

/**
 * Dispose the singleton highlighter, freeing resources.
 */
export const disposeHighlighter = (): void => {
    languageLoadPromises.clear();
    themeLoadPromises.clear();
    tokenCache.clear();

    if (highlighterPromise) {
        highlighterPromise
            .then((h) => {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (h as any).dispose?.();
                } catch {
                    // ignore
                }
            })
            .catch(() => {
                // ignore
            });
        highlighterPromise = undefined;
    }
};

export default getHighlighter;
