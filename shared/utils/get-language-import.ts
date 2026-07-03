import type { LanguageInput } from "shiki";

/**
 * Maps language names to their corresponding Shiki language import paths.
 * This allows dynamic loading of languages using loadLanguage().
 */
export const LANGUAGE_IMPORT_MAP: Record<string, () => Promise<LanguageInput>> = {
    javascript: () => import("@shikijs/langs/javascript"),
    typescript: () => import("@shikijs/langs/typescript"),
    jsx: () => import("@shikijs/langs/jsx"),
    tsx: () => import("@shikijs/langs/tsx"),
    json: () => import("@shikijs/langs/json"),
    json5: () => import("@shikijs/langs/json5"),
    jsonc: () => import("@shikijs/langs/jsonc"),
    xml: () => import("@shikijs/langs/xml"),
    sql: () => import("@shikijs/langs/sql"),
    markdown: () => import("@shikijs/langs/markdown"),
    mdx: () => import("@shikijs/langs/mdx"),
    html: () => import("@shikijs/langs/html"),
    css: () => import("@shikijs/langs/css"),
    scss: () => import("@shikijs/langs/scss"),
    less: () => import("@shikijs/langs/less"),
    sass: () => import("@shikijs/langs/sass"),
    stylus: () => import("@shikijs/langs/stylus"),
    styl: () => import("@shikijs/langs/styl"),
    svelte: () => import("@shikijs/langs/svelte"),
    vue: () => import("@shikijs/langs/vue"),
    bash: () => import("@shikijs/langs/bash"),
    shell: () => import("@shikijs/langs/shell"),
    yaml: () => import("@shikijs/langs/yaml"),
    toml: () => import("@shikijs/langs/toml"),
    python: () => import("@shikijs/langs/python"),
    go: () => import("@shikijs/langs/go"),
    rust: () => import("@shikijs/langs/rust"),
    ruby: () => import("@shikijs/langs/ruby"),
    php: () => import("@shikijs/langs/php"),
    graphql: () => import("@shikijs/langs/graphql"),
    dockerfile: () => import("@shikijs/langs/dockerfile"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text: () => Promise.resolve({ name: "text", patterns: [], scopeName: "source.text", repository: {} } as any as LanguageInput),
};

/**
 * Gets the language import for a given language name.
 * @param langName - The language name (e.g., "javascript", "typescript")
 * @returns Promise resolving to the language input, or undefined if not found
 */
const getLanguageImport = async (langName: string): Promise<LanguageInput | undefined> => {
    if (typeof langName !== "string" || !langName) {
        return undefined;
    }

    const importer = LANGUAGE_IMPORT_MAP[langName.toLowerCase()];

    if (!importer) {
        return undefined;
    }

    return await importer();
};

export default getLanguageImport;
