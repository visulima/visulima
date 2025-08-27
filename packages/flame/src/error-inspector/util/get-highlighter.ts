import type { Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | undefined;
let disposeFn: (() => void) | undefined;

const createSingletonHighlighter = async (): Promise<Highlighter> => {
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
            langs: ["javascript", "typescript", "jsx", "tsx", "json", "jsonc", "xml", "sql", "bash", "shell"],
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

const getHighlighter = async (): Promise<Highlighter> => {
    if (!highlighterPromise) {
        highlighterPromise = createSingletonHighlighter();
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
