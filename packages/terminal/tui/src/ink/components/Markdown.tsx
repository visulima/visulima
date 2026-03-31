/* eslint-disable react/function-component-definition, unicorn/filename-case, react-x/no-array-index-key */

/**
 * Markdown rendering component for Ink.
 *
 * Parses Markdown with `marked` and maps tokens to Ink React elements.
 * Code blocks are rendered with syntax highlighting via the Code component.
 */
import { Lexer } from "marked";
import type { ReactElement, ReactNode } from "react";
import React, { useMemo } from "react";

import useWindowSize from "../hooks/use-window-size";
import Box from "./Box";
import Code from "./Code";
import Link from "./Link";
import Newline from "./Newline";
import OrderedList from "./OrderedList";
import type { OrderedListEntry } from "./OrderedList";
import Table from "./Table";
import Text from "./Text";
import UnorderedList from "./UnorderedList";
import type { UnorderedListEntry } from "./UnorderedList";

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

type MarkedToken = ReturnType<typeof Lexer.lex>[number];
type MarkedInlineToken = { raw: string; text: string; tokens?: MarkedInlineToken[]; type: string; [key: string]: unknown };

/**
 * Render inline tokens (text, bold, italic, code, links, etc.)
 */
function renderInlineTokens(tokens: MarkedInlineToken[] | undefined): ReactNode {
    if (!tokens || tokens.length === 0) {
        return null;
    }

    return tokens.map((token, index) => {
        switch (token.type) {
            case "text": {
                return <React.Fragment key={index}>{token.text}</React.Fragment>;
            }

            case "strong": {
                return <Text bold key={index}>{renderInlineTokens(token.tokens)}</Text>;
            }

            case "em": {
                return <Text italic key={index}>{renderInlineTokens(token.tokens)}</Text>;
            }

            case "del": {
                return <Text key={index} strikethrough>{renderInlineTokens(token.tokens)}</Text>;
            }

            case "codespan": {
                return (
                    <Text inverse key={index}>
                        {" "}{token.text}{" "}
                    </Text>
                );
            }

            case "link": {
                return (
                    <Link key={index} url={token.href as string}>
                        {renderInlineTokens(token.tokens) ?? token.text}
                    </Link>
                );
            }

            case "br": {
                return <Newline key={index} />;
            }

            case "image": {
                return (
                    <Text dimColor key={index}>
                        [image: {(token.text as string) || (token.href as string)}]
                    </Text>
                );
            }

            case "escape": {
                return <React.Fragment key={index}>{token.text}</React.Fragment>;
            }

            default: {
                // Unknown inline token — render raw text
                return <React.Fragment key={index}>{token.raw ?? token.text ?? ""}</React.Fragment>;
            }
        }
    });
}

/**
 * Map marked list items to OrderedListEntry or UnorderedListEntry.
 */
function mapListItems(items: MarkedToken[]): (OrderedListEntry | UnorderedListEntry)[] {
    return items.map((item: MarkedToken) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listItem = item as any;

        // marked list_item has block-level tokens; the inline content is inside the first "text" token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textToken = listItem.tokens?.find((t: any) => t.type === "text");
        const label = renderInlineTokens(textToken?.tokens ?? listItem.tokens);

        // Check for nested lists within the item's tokens
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nestedList = listItem.tokens?.find((t: any) => t.type === "list");
        const children = nestedList ? mapListItems(nestedList.items) : undefined;

        return { children, label } as OrderedListEntry | UnorderedListEntry;
    });
}

/**
 * Render block-level tokens recursively.
 */
function renderBlockTokens(tokens: MarkedToken[], codeTheme: string, maxWidth: number): ReactNode[] {
    const elements: ReactNode[] = [];

    for (let index = 0; index < tokens.length; index++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = tokens[index] as any;
        const marginTop = index > 0 ? 1 : 0;

        switch (token.type) {
            case "heading": {
                const color = HEADING_COLORS[token.depth as number] ?? "white";
                const prefix = "#".repeat(token.depth as number) + " ";

                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Text bold color={color}>
                            {prefix}
                            {renderInlineTokens(token.tokens)}
                        </Text>
                    </Box>,
                );
                break;
            }

            case "paragraph": {
                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Text wrap="wrap">{renderInlineTokens(token.tokens)}</Text>
                    </Box>,
                );
                break;
            }

            case "code": {
                elements.push(
                    <Box key={index} marginTop={marginTop}>
                        <Code code={token.text as string} language={token.lang as string | undefined} theme={codeTheme} />
                    </Box>,
                );
                break;
            }

            case "blockquote": {
                elements.push(
                    <Box borderLeft borderLeftColor="gray" key={index} marginTop={marginTop} paddingLeft={1}>
                        <Box flexDirection="column">
                            {renderBlockTokens(token.tokens ?? [], codeTheme, maxWidth - 3)}
                        </Box>
                    </Box>,
                );
                break;
            }

            case "list": {
                const items = mapListItems(token.items);

                if (token.ordered) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <OrderedList items={items as OrderedListEntry[]} />
                        </Box>,
                    );
                } else {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <UnorderedList items={items as UnorderedListEntry[]} />
                        </Box>,
                    );
                }
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

            case "table": {
                const headers: string[] = (token.header ?? []).map((cell: { text: string }) => cell.text);
                const rows: string[][] = (token.rows ?? []).map((row: { text: string }[]) => row.map((cell) => cell.text));
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

            case "html": {
                // Strip HTML tags and render as plain text
                const stripped = (token.text as string).replaceAll(/<[^>]*>/g, "");

                if (stripped.trim()) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <Text dimColor>{stripped}</Text>
                        </Box>,
                    );
                }
                break;
            }

            case "space": {
                elements.push(<Newline key={index} />);
                break;
            }

            default: {
                // Unknown block token — render raw text
                if (token.text || token.raw) {
                    elements.push(
                        <Box key={index} marginTop={marginTop}>
                            <Text>{token.text ?? token.raw}</Text>
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
 * Render Markdown content as Ink terminal UI elements.
 *
 * ```tsx
 * <Markdown>{"# Hello\n\nThis is **bold** and *italic*."}</Markdown>
 * <Markdown codeTheme="github-dark-default">{"```js\nconst x = 1;\n```"}</Markdown>
 * ```
 */
/**
 * Detect if markdown ends with an incomplete block (unclosed code fence, etc.)
 * and append the trailing text as a paragraph so it renders during streaming.
 */
function lexWithStreamingFallback(source: string, streaming: boolean): MarkedToken[] {
    const tokens = Lexer.lex(source);

    if (!streaming || source.length === 0) {
        return tokens;
    }

    // Check if there's unrendered trailing text after the last token.
    // marked's Lexer silently drops text after an unclosed code fence.
    let consumedLength = 0;

    for (const token of tokens) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        consumedLength += ((token as any).raw as string)?.length ?? 0;
    }

    if (consumedLength < source.length) {
        const trailing = source.slice(consumedLength);

        if (trailing.trim().length > 0) {
            // Append trailing text as a paragraph token so it renders
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tokens.push({ raw: trailing, text: trailing, tokens: [{ raw: trailing, text: trailing, type: "text" }], type: "paragraph" } as any);
        }
    }

    return tokens;
}

/**
 * Render Markdown content as Ink terminal UI elements.
 *
 * ```tsx
 * <Markdown>{"# Hello\n\nThis is **bold** and *italic*."}</Markdown>
 * <Markdown codeTheme="github-dark-default">{"```js\nconst x = 1;\n```"}</Markdown>
 * <Markdown streaming>{"# Streaming\n\nText arriving..."}</Markdown>
 * ```
 */
export default function Markdown({
    children,
    codeTheme = "github-dark-default",
    maxWidth: maxWidthProp,
    streaming = false,
}: Props): ReactElement {
    const { columns } = useWindowSize();
    const maxWidth = maxWidthProp ?? columns ?? 80;

    const tokens = useMemo(() => lexWithStreamingFallback(children, streaming), [children, streaming]);
    const elements = useMemo(() => renderBlockTokens(tokens, codeTheme, maxWidth), [tokens, codeTheme, maxWidth]);

    return (
        <Box flexDirection="column">
            {elements}
        </Box>
    );
}
