/* eslint-disable consistent-return, no-void, react-x/no-array-index-key, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react/function-component-definition */

/**
 * Syntax-highlighted code display component for Ink.
 *
 * Uses Shiki for tokenization and maps themed tokens to colored
 * Ink Text elements for terminal rendering.
 */
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { ThemedToken } from "shiki";

import getHighlighter, { getCachedTokens, isLanguageSupported, resolveLanguage } from "../highlighter";
import type { TokenRenderOptions } from "../token-to-elements";
import { tokenLinesToElements } from "../token-to-elements";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * The source code string to highlight.
     */
    readonly code: string;

    /**
     * Set of line numbers to visually emphasize.
     */
    readonly highlightLines?: ReadonlySet<number>;

    /**
     * Programming language for syntax highlighting.
     * Falls back to plain text if the language is unknown.
     */
    readonly language?: string;

    /**
     * Whether to show line numbers in the gutter.
     * @default false
     */
    readonly showLineNumbers?: boolean;

    /**
     * Starting line number (useful for code excerpts).
     * @default 1
     */
    readonly startLine?: number;

    /**
     * Shiki theme name.
     * @default "github-dark-default"
     */
    readonly theme?: string;
};

/**
 * Render source code with syntax highlighting.
 *
 * ```tsx
 * &lt;Code code="const x = 42;" language="typescript" />
 * &lt;Code code={source} language="python" showLineNumbers />
 * ```
 */
export default function Code({ code, highlightLines, language, showLineNumbers = false, startLine = 1, theme = "github-dark-default" }: Props): ReactElement {
    const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;

        const lang = language ? resolveLanguage(language) : "text";

        if (lang !== "text" && !isLanguageSupported(lang)) {
            // Unknown language — stay with plain rendering
            setTokens(null); // eslint-disable-line react-x/set-state-in-effect

            return;
        }

        void (async () => {
            try {
                const highlighter = await getHighlighter(lang === "text" ? [] : [lang], theme);
                const result = getCachedTokens(highlighter, code, lang, theme);

                if (!cancelledRef.current) {
                    setTokens(result.tokens);
                }
            } catch {
                // Highlighting failed — fall back to plain text
                if (!cancelledRef.current) {
                    setTokens(null);
                }
            }
        })();

        return () => {
            cancelledRef.current = true;
        };
    }, [code, language, theme]);

    const renderOptions: TokenRenderOptions = { highlightLines, showLineNumbers, startLine };

    // Highlighted rendering
    if (tokens) {
        return tokenLinesToElements(tokens, renderOptions);
    }

    // Plain text fallback (before highlighting resolves or for unsupported languages)
    const lines = code.split("\n");
    const gutterWidth = showLineNumbers ? String(startLine + lines.length - 1).length : 0;

    return (
        <Box flexDirection="column">
            {lines.map((line, index) => {
                const lineNumber = startLine + index;
                const isHighlighted = highlightLines?.has(lineNumber) ?? false;

                return (
                    <Box key={index}>
                        {showLineNumbers ? (
                            <Text color={isHighlighted ? "yellow" : undefined} dimColor={!isHighlighted}>
                                {String(lineNumber).padStart(gutterWidth)}{" "}
                            </Text>
                        ) : undefined}
                        <Text>{line}</Text>
                    </Box>
                );
            })}
        </Box>
    );
}
