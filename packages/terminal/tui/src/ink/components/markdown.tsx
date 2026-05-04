/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unnecessary-condition, jsdoc/match-description, jsx-a11y/anchor-is-valid, no-secrets/no-secrets, react-x/no-array-index-key, react/function-component-definition, sonarjs/slow-regex */

/**
 * Markdown rendering component for Ink.
 *
 * Parses Markdown with `marked` and maps tokens to Ink React elements.
 * Code blocks are rendered with syntax highlighting via the Code component.
 */
import type { Token, Tokens } from "marked";
import { Lexer } from "marked";
import type { ReactElement, ReactNode } from "react";
import React, { useMemo } from "react";

import useWindowSize from "../hooks/use-window-size";
import Box from "./box";
import Code from "./code";
import Link from "./link";
import Newline from "./newline";
import type { OrderedListEntry } from "./ordered-list";
import OrderedList from "./ordered-list";
import Table from "./table";
import Text from "./text";
import type { UnorderedListEntry } from "./unordered-list";
import UnorderedList from "./unordered-list";

export type Props = {
    /**
     * The Markdown source string.
     */
    readonly children: string;

    /**
     * Shiki theme for code block syntax highlighting.
     * @default "github-dark-default"
     */
    readonly codeTheme?: string;

    /**
     * Maximum width for text wrapping. Defaults to terminal width.
     */
    readonly maxWidth?: number;

    /**
     * Enable streaming mode for progressive rendering.
     * When true, the component re-renders on every prop change and handles
     * incomplete Markdown gracefully (e.g., unclosed code fences, partial lists).
     * Useful for rendering AI-generated text arriving token-by-token.
     * @default false
     */
    readonly streaming?: boolean;
};

// Heading colors by depth
const HEADING_COLORS: Record<number, string> = {
    1: "cyan",
    2: "green",
    3: "yellow",
    4: "blue",
    5: "magenta",
    6: "gray",
};

type InlineToken = Tokens.Strong | Tokens.Em | Tokens.Del | Tokens.Codespan | Tokens.Link | Tokens.Br | Tokens.Image | Tokens.Escape | Tokens.Text;

/**
 * Render inline tokens (text, bold, italic, code, links, etc.)
 */
function renderInlineTokens(tokens: InlineToken[] | Token[] | undefined): ReactNode {
    if (!tokens || tokens.length === 0) {
        return null;
    }

    return tokens.map((token, index) => {
        switch (token.type) {
            case "br": {
                return <Newline key={index} />;
            }

            case "codespan": {
                return (
                    <Text inverse key={index}>
                        {" "}
                        {token.text}
{" "}
                    </Text>
                );
            }

            case "del": {
                return (
                    <Text key={index} strikethrough>
                        {renderInlineTokens(token.tokens)}
                    </Text>
                );
            }

            case "em": {
                return (
                    <Text italic key={index}>
                        {renderInlineTokens(token.tokens)}
                    </Text>
                );
            }

            case "escape": {
                return <React.Fragment key={index}>{token.text}</React.Fragment>;
            }

            case "image": {
                const img = token as Tokens.Image;

                return (
                    <Text dimColor key={index}>
                        [image:
{" "}
{img.text || img.href}
]
                    </Text>
                );
            }

            case "link": {
                const link = token as Tokens.Link;

                return (
                    <Link key={index} url={link.href}>
                        {renderInlineTokens(link.tokens) ?? link.text}
                    </Link>
                );
            }

            case "strong": {
                return (
                    <Text bold key={index}>
                        {renderInlineTokens(token.tokens)}
                    </Text>
                );
            }

            case "text": {
                return <React.Fragment key={index}>{token.text}</React.Fragment>;
            }

            default: {
                // Unknown inline token — render raw text
                const rawText = "raw" in token ? (token as { raw: string }).raw : "";

                return <React.Fragment key={index}>{rawText}</React.Fragment>;
            }
        }
    });
}

/**
 * Map marked list items to OrderedListEntry or UnorderedListEntry.
 */
function mapListItems(items: Token[]): (OrderedListEntry | UnorderedListEntry)[] {
    return items.map((item: Token) => {
        const listItem = item as Tokens.ListItem;
        const listItemTokens = listItem.tokens ?? [];

        // marked list_item has block-level tokens; the inline content is inside the first "text" token
        const textToken = listItemTokens.find((t) => t.type === "text") as Tokens.Text | undefined;
        const label = renderInlineTokens(textToken?.tokens ?? listItemTokens);

        // Check for nested lists within the item's tokens
        const nestedList = listItemTokens.find((t) => t.type === "list") as Tokens.List | undefined;
        const children = nestedList ? mapListItems(nestedList.items) : undefined;

        return { children, label };
    });
}

/**
 * Render block-level tokens recursively.
 */
function renderBlockTokens(tokens: Token[], codeTheme: string, maxWidth: number): ReactNode[] {
    const elements: ReactNode[] = [];

    for (const [index, token_] of tokens.entries()) {
        const token = token_;
        const marginTop = index > 0 ? 1 : 0;

        switch (token.type) {
            case "blockquote": {
                const bq = token as Tokens.Blockquote;

                elements.push(
                    <Box borderLeft borderLeftColor="gray" key={index} marginTop={marginTop} paddingLeft={1}>
                        <Box flexDirection="column">{renderBlockTokens(bq.tokens, codeTheme, maxWidth - 3)}</Box>
                    </Box>,
                );
                break;
            }

            case "code": {
                const code = token as Tokens.Code;

                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Code code={code.text} language={code.lang} theme={codeTheme} />
                    </Box>,
                );
                break;
            }

            case "heading": {
                const heading = token as Tokens.Heading;
                const color = HEADING_COLORS[heading.depth] ?? "white";
                const prefix = `${"#".repeat(heading.depth)} `;

                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Text bold color={color}>
                            {prefix}
                            {renderInlineTokens(heading.tokens)}
                        </Text>
                    </Box>,
                );
                break;
            }

            case "hr": {
                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Text dimColor>{"─".repeat(Math.min(maxWidth, 40))}</Text>
                    </Box>,
                );
                break;
            }

            case "html": {
                const html = token as Tokens.HTML;
                // Strip HTML tags and render as plain text
                const stripped = html.text.replaceAll(/<[^>]*>/g, "");

                if (stripped.trim()) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <Text dimColor>{stripped}</Text>
                        </Box>,
                    );
                }

                break;
            }

            case "list": {
                const list = token as Tokens.List;
                const items = mapListItems(list.items);

                if (list.ordered) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <OrderedList items={items} />
                        </Box>,
                    );
                } else {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <UnorderedList items={items} />
                        </Box>,
                    );
                }

                break;
            }

            case "paragraph": {
                const para = token as Tokens.Paragraph;

                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Text wrap="wrap">{renderInlineTokens(para.tokens)}</Text>
                    </Box>,
                );
                break;
            }

            case "space": {
                elements.push(<Newline key={index} />);
                break;
            }

            case "table": {
                const table = token as Tokens.Table;
                const headers: string[] = (table.header ?? []).map((cell) => cell.text);
                const rows: string[][] = (table.rows ?? []).map((row) => row.map((cell) => cell.text));
                const data = rows.map((row: string[]) => {
                    const record: Record<string, string> = {};

                    headers.forEach((header: string, colIndex: number) => {
                        record[header] = row[colIndex] ?? "";
                    });

                    return record;
                });

                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Table data={data} />
                    </Box>,
                );
                break;
            }

            default: {
                // Unknown block token — render raw text
                const raw = "raw" in token ? (token as { raw: string }).raw : "";
                const text = "text" in token ? (token as { text: string }).text : raw;

                if (text) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <Text>{text}</Text>
                        </Box>,
                    );
                }

                break;
            }
        }
    }

    return elements;
}

/**
 * Detect if markdown ends with an incomplete block (unclosed code fence, etc.)
 * and append the trailing text as a paragraph so it renders during streaming.
 */
function lexWithStreamingFallback(source: string, streaming: boolean): Token[] {
    const tokens = Lexer.lex(source);

    if (!streaming || source.length === 0) {
        return tokens;
    }

    // Check if there's unrendered trailing text after the last token.
    // marked's Lexer silently drops text after an unclosed code fence.
    let consumedLength = 0;

    for (const token of tokens) {
        consumedLength += token.raw?.length ?? 0;
    }

    if (consumedLength < source.length) {
        const trailing = source.slice(consumedLength);

        if (trailing.trim().length > 0) {
            // Append trailing text as a paragraph token so it renders

            tokens.push({ raw: trailing, text: trailing, tokens: [{ raw: trailing, text: trailing, type: "text" }], type: "paragraph" });
        }
    }

    return tokens;
}

/**
 * Render Markdown content as Ink terminal UI elements.
 *
 * ```tsx
 * &lt;Markdown>{"# Hello\n\nThis is **bold** and *italic*."}&lt;/Markdown>
 * &lt;Markdown codeTheme="github-dark-default">{"```js\nconst x = 1;\n```"}&lt;/Markdown>
 * &lt;Markdown streaming>{"# Streaming\n\nText arriving..."}&lt;/Markdown>
 * ```
 */
export default function Markdown({ children, codeTheme = "github-dark-default", maxWidth: maxWidthProp, streaming = false }: Props): ReactElement {
    const { columns } = useWindowSize();
    const maxWidth = maxWidthProp ?? columns ?? 80;

    const tokens = useMemo(() => lexWithStreamingFallback(children, streaming), [children, streaming]);
    const elements = useMemo(() => renderBlockTokens(tokens, codeTheme, maxWidth), [tokens, codeTheme, maxWidth]);

    return <Box flexDirection="column">{elements}</Box>;
}
