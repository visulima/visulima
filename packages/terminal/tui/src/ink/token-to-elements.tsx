/* eslint-disable react-x/no-array-index-key, no-bitwise */

/**
 * Convert Shiki ThemedToken[][] to Ink React elements for terminal rendering.
 */
import type { ReactElement } from "react";
import type { ThemedToken } from "shiki";

import Box from "../components/box";
import Text from "../components/text";

// FontStyle bitmask values from @shikijs/vscode-textmate
const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;
const FONT_STYLE_UNDERLINE = 4;
const FONT_STYLE_STRIKETHROUGH = 8;

export type TokenRenderOptions = {
    readonly highlightLines?: ReadonlySet<number>;
    readonly showLineNumbers?: boolean;
    readonly startLine?: number;
};

/**
 * Render a single ThemedToken as a styled &lt;Text> element.
 */
export const renderToken = (token: ThemedToken, key: number): ReactElement => {
    const fontStyle = token.fontStyle ?? 0;

    return (
        <Text
            backgroundColor={token.bgColor}
            bold={(fontStyle & FONT_STYLE_BOLD) !== 0}
            color={token.color}
            italic={(fontStyle & FONT_STYLE_ITALIC) !== 0}
            key={key}
            strikethrough={(fontStyle & FONT_STYLE_STRIKETHROUGH) !== 0}
            underline={(fontStyle & FONT_STYLE_UNDERLINE) !== 0}
        >
            {token.content}
        </Text>
    );
};

/**
 * Render a single line of tokens as inline React elements (no Box wrapper).
 */
export const renderTokenLine = (tokens: ThemedToken[]): ReactElement => <>{tokens.map((token, index) => renderToken(token, index))}</>;

/**
 * Convert Shiki token lines to Ink React elements with optional line numbers.
 */
export const tokenLinesToElements = (lines: ThemedToken[][], options: TokenRenderOptions = {}): ReactElement => {
    const { highlightLines, showLineNumbers = false, startLine = 1 } = options;
    const gutterWidth = showLineNumbers ? String(startLine + lines.length - 1).length : 0;

    return (
        <Box flexDirection="column">
            {lines.map((line, lineIndex) => {
                const lineNumber = startLine + lineIndex;
                const isHighlighted = highlightLines?.has(lineNumber) ?? false;

                return (
                    <Box key={lineIndex}>
                        {showLineNumbers ? (
                            <Text color={isHighlighted ? "yellow" : undefined} dimColor={!isHighlighted}>
                                {String(lineNumber).padStart(gutterWidth)}{" "}
                            </Text>
                        ) : undefined}
                        <Text backgroundColor={isHighlighted ? "#3a3a00" : undefined}>
                            {line.length > 0 ? line.map((token, tokenIndex) => renderToken(token, tokenIndex)) : ""}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
};
