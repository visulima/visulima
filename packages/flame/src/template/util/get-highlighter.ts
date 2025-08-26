import type { Highlighter } from "shiki";
import { createHighlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | undefined;

const getHighlighter = async (): Promise<Highlighter> => {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            langs: ["javascript", "typescript", "jsx", "tsx", "json", "jsonc", "json5", "xml", "sql", "bash", "shell"],
            themes: ["github-dark-default", "github-light"],
        });
    }

    return highlighterPromise;
};

export default getHighlighter;
