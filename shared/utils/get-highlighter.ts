import type { Highlighter, LanguageInput, ShikiTransformer } from "shiki";

let highlighterPromise: Promise<Highlighter> | undefined;
let disposeFn: (() => void) | undefined;

const createSingletonHighlighter = async (langs: LanguageInput[] = []): Promise<Highlighter> => {
    // Try fine-grained modules first for better perf and bundle size
    try {
        const [coreMod, engineMod] = await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);
        const { createHighlighterCore } = coreMod as any;
        const { createJavaScriptRegexEngine } = engineMod as any;

        const highlighterCore: unknown = await createHighlighterCore({
            // Defer loading of themes/langs to the core loader
            themes: [import("@shikijs/themes/github-dark-default"), import("@shikijs/themes/github-light")],
            langs: [
                import("@shikijs/langs/javascript"),
                import("@shikijs/langs/typescript"),
                import("@shikijs/langs/jsx"),
                import("@shikijs/langs/tsx"),
                import("@shikijs/langs/json"),
                import("@shikijs/langs/jsonc"),
                import("@shikijs/langs/xml"),
                import("@shikijs/langs/sql"),
                import("@shikijs/langs/bash"),
                import("@shikijs/langs/shell"),
                import("@shikijs/langs/markdown"),
                import("@shikijs/langs/mdx"),
                import("@shikijs/langs/html"),
                import("@shikijs/langs/css"),
                import("@shikijs/langs/scss"),
                import("@shikijs/langs/less"),
                import("@shikijs/langs/sass"),
                import("@shikijs/langs/stylus"),
                import("@shikijs/langs/styl"),
                ...langs,
            ],
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
    } catch {
        // Fallback to the monolithic build to preserve current behavior
        const { createHighlighter } = await import("shiki");
        const highlighter: unknown = await createHighlighter({
            langs: [
                "javascript",
                "typescript",
                "jsx",
                "tsx",
                "json",
                "jsonc",
                "xml",
                "sql",
                "bash",
                "shell",
                "markdown",
                "mdx",
            ],
            themes: ["github-dark-default", "github-light"],
        });

        disposeFn = () => {
            try {
                (highlighter as any)?.dispose?.();
            } catch {}
            highlighterPromise = undefined;
        };

        return highlighter as Highlighter;
    }
};

const getHighlighter = async (langs: LanguageInput[] = []): Promise<Highlighter> => {
    if (!highlighterPromise) {
        highlighterPromise = createSingletonHighlighter(langs);
    }

    return highlighterPromise;
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
            if (lineOption?.classes) this.addClassToHast(node, lineOption.classes);
            return node;
        },
    } as ShikiTransformer;
};
