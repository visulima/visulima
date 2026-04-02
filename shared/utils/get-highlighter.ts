import type { Highlighter, LanguageInput, ShikiTransformer } from "shiki";

import { LANGUAGE_IMPORT_MAP } from "./get-language-import";

let highlighterPromise: Promise<Highlighter> | undefined;
let disposeFn: (() => void) | undefined;

const createSingletonHighlighter = async (): Promise<Highlighter> => {
    const [coreMod, engineMod] = await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);
    const { createHighlighterCore } = coreMod as any;
    const { createJavaScriptRegexEngine } = engineMod as any;

    const highlighterCore: unknown = await createHighlighterCore({
        // Defer loading of themes/langs to the core loader
        themes: [import("@shikijs/themes/min-dark"), import("@shikijs/themes/min-light")],
        langs: [],
        engine: createJavaScriptRegexEngine(),
    });

    const highlighter = highlighterCore as Highlighter;

    disposeFn = () => {
        try {
            (highlighterCore as any)?.dispose?.();
        } catch {}
        highlighterPromise = undefined;
    };

    return highlighter;
};

/**
 * Loads a language dynamically if it's not already loaded.
 * @param highlighter - The Shiki highlighter instance
 * @param langName - The language name to load
 */
const ensureLanguageLoaded = async (highlighter: Highlighter, langName: string): Promise<void> => {
    // Skip "text" language as it's handled separately
    if (langName === "text") {
        return;
    }

    const normalizedLangName = langName.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadedLanguages: string[] = (highlighter as any).getLoadedLanguages?.() ?? (highlighter as any).getLanguages?.() ?? [];

    if (!loadedLanguages.includes(normalizedLangName)) {
        const importer = LANGUAGE_IMPORT_MAP[normalizedLangName];

        if (importer) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await highlighter.loadLanguage?.(await importer() as any);
        }
    }
};

/**
 * Gets or creates a singleton highlighter instance.
 * Languages are loaded dynamically on-demand using Shiki's loadLanguage() method.
 * @param langNamesOrInputs - Optional array of language names (strings) or LanguageInput objects
 * @returns Promise resolving to the highlighter instance
 */
const getHighlighter = async (langNamesOrInputs: (string | LanguageInput)[] = []): Promise<Highlighter> => {
    // Create highlighter if it doesn't exist
    if (!highlighterPromise) {
        highlighterPromise = createSingletonHighlighter();
    }

    const highlighter = await highlighterPromise;

    // Extract language names and load them dynamically
    const langNames: string[] = [];

    for (const item of langNamesOrInputs) {
        if (typeof item === "string") {
            langNames.push(item.toLowerCase());
        } else {
            const langName = (item as any).name;
            if (langName) {
                langNames.push(langName.toLowerCase());
            }
        }
    }

    // Load all requested languages
    await Promise.all(langNames.map((langName) => ensureLanguageLoaded(highlighter, langName)));

    return highlighter;
};

export const disposeHighlighter = async (): Promise<void> => {
    try {
        if (disposeFn) {
            disposeFn();
            disposeFn = undefined;
        }
    } catch {}
};

export default getHighlighter;

/**
 * Transformer for `shiki`'s legacy `lineOptions`, allows to add classes to specific lines
 * FROM: https://github.com/shikijs/shiki/blob/4a58472070a9a359a4deafec23bb576a73e24c6a/packages/transformers/src/transformers/compact-line-options.ts
 * LICENSE: https://github.com/shikijs/shiki/blob/4a58472070a9a359a4deafec23bb576a73e24c6a/LICENSE
 */
export const transformerCompactLineOptions = (
    lineOptions: { line: number; classes?: string[] }[] = [],
): ShikiTransformer => {
    return {
        name: '@shikijs/transformers:compact-line-options',
        line(node, line) {
            const lineOption = lineOptions.find((o) => o.line === line);

            if (lineOption?.classes) {
                this.addClassToHast(node, lineOption.classes);
            }

            return node;
        },
    } as ShikiTransformer;
};
