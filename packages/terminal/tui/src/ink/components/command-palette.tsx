/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import { isInsertableInput } from "../input-utils";
import Box from "./box";
import Text from "./text";

export type CommandEntry = {
    /**
     * Optional description rendered under the label.
     */
    readonly description?: string;

    /**
     * Optional hotkey rendered on the right.
     */
    readonly hotkey?: string;

    /**
     * Optional icon rendered before the label.
     */
    readonly icon?: ReactNode;

    /**
     * Stable identifier returned by `onSelect`.
     */
    readonly id: string;

    /**
     * Optional keywords to boost matching (not displayed).
     */
    readonly keywords?: ReadonlyArray<string>;

    /**
     * Label shown in the list (and used as the primary match target).
     */
    readonly label: string;
};

export type Props = {
    /**
     * Accent color for the border and focused row.
     * @default "cyan"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the palette on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Available commands to search.
     */
    readonly commands: ReadonlyArray<CommandEntry>;

    /**
     * Empty-state text when nothing matches.
     * @default "No results"
     */
    readonly emptyText?: string;

    /**
     * Max rows rendered in the list.
     * @default 8
     */
    readonly limit?: number;

    /**
     * Called when the user presses Escape.
     */
    readonly onCancel?: () => void;

    /**
     * Called when the user picks a command with Enter.
     */
    readonly onSelect: (id: string, query: string) => void;

    /**
     * Placeholder inside the search field.
     * @default "Type a command or search..."
     */
    readonly placeholder?: string;
};

/**
 * Rank candidates by a simple subsequence scoring algorithm. Higher is better.
 */
const scoreCommand = (query: string, command: CommandEntry): number => {
    if (query.length === 0) {
        return 1;
    }

    const haystacks = [command.label, command.description ?? "", ...command.keywords ?? []]
        .map((text) => text.toLowerCase())
        .filter((text) => text.length > 0);

    const needle = query.toLowerCase();
    let best = 0;

    for (const haystack of haystacks) {
        if (haystack.includes(needle)) {
            // Direct substring match: the earlier the match, the better.
            const index = haystack.indexOf(needle);

            best = Math.max(best, 100 - index);

            continue;
        }

        // Fallback: subsequence match. Count consecutive chars.
        let haystackIndex = 0;
        let matched = 0;

        for (const char of needle) {
            const found = haystack.indexOf(char, haystackIndex);

            if (found === -1) {
                matched = 0;

                break;
            }

            matched += 1;
            haystackIndex = found + 1;
        }

        if (matched === needle.length) {
            best = Math.max(best, 20);
        }
    }

    return best;
};

/**
 * Ctrl-P style fuzzy command finder. Features a search input, ranked results,
 * keyboard navigation, and Esc to cancel.
 */
export default function CommandPalette({
    accentColor = "cyan",
    autoFocus = true,
    commands,
    emptyText = "No results",
    limit = 8,
    onCancel,
    onSelect,
    placeholder = "Type a command or search...",
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus });
    const [query, setQuery] = useState("");
    const [focusedIndex, setFocusedIndex] = useState(0);
    const focusedIndexRef = useRef(focusedIndex);

    focusedIndexRef.current = focusedIndex;

    const filtered = useMemo(() => {
        const scored = commands
            .map((command) => {
                return { command, score: scoreCommand(query, command) };
            })
            .filter(({ score }) => score > 0);

        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, limit).map(({ command }) => command);
    }, [commands, query, limit]);

    // Keep `focusedIndex` inside the live range. This handles shrinking
    // results (typing narrows the list) and external changes to `commands`
    // that would otherwise leave focus pointing past the last row.
    useEffect(() => {
        const maxIndex = Math.max(0, filtered.length - 1);

        if (focusedIndexRef.current > maxIndex) {
            focusedIndexRef.current = maxIndex;
            setFocusedIndex(maxIndex);
        }
    }, [filtered]);

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.escape) {
                    onCancel?.();

                    return;
                }

                if (key.downArrow) {
                    if (filtered.length === 0) {
                        return;
                    }

                    setFocusedIndex((previous) => Math.min(filtered.length - 1, previous + 1));

                    return;
                }

                if (key.upArrow) {
                    setFocusedIndex((previous) => Math.max(0, previous - 1));

                    return;
                }

                if (key.return) {
                    const target = filtered[focusedIndexRef.current];

                    if (target) {
                        onSelect(target.id, query);
                    }

                    return;
                }

                if (key.backspace || key.delete) {
                    setQuery((previous) => previous.slice(0, -1));
                    setFocusedIndex(0);

                    return;
                }

                if (isInsertableInput(input, key)) {
                    setQuery((previous) => previous + input);
                    setFocusedIndex(0);
                }
            },
            [isFocused, filtered, query, onSelect, onCancel],
        ),
        { isActive: isFocused },
    );

    return (
        <Box borderColor={accentColor} borderStyle="round" flexDirection="column" paddingX={1}>
            <Box>
                <Text color={accentColor}>❯</Text>
                <Text>
                    {" "}
                    {query.length === 0 ? <Text dimColor>{placeholder}</Text> : query}
                </Text>
                <Text inverse> </Text>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>
                    {filtered.length}
                    {" of "}
                    {commands.length}
                </Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
                {filtered.length === 0
                    ? (
                        <Text dimColor>{emptyText}</Text>
                    )
                    : filtered.map((command, index) => {
                        const isRowFocused = index === focusedIndex;
                        const color = isRowFocused ? accentColor : undefined;

                        return (
                            <Box flexDirection="column" key={command.id}>
                                <Box>
                                    <Text color={color}>{isRowFocused ? "▸ " : "  "}</Text>
                                    {command.icon === undefined
                                        ? undefined
                                        : (
                                            <Text color={color}>
                                                {command.icon}
                                                {" "}
                                            </Text>
                                        )}
                                    <Box flexGrow={1} flexShrink={1} minWidth={0}>
                                        <Text bold={isRowFocused} color={color} wrap="truncate-end">
                                            {command.label}
                                        </Text>
                                    </Box>
                                    {command.hotkey === undefined
                                        ? undefined
                                        : (
                                            <Box flexShrink={0}>
                                                <Text dimColor>
                                                    {" "}
                                                    {command.hotkey}
                                                </Text>
                                            </Box>
                                        )}
                                </Box>
                                {command.description === undefined
                                    ? undefined
                                    : (
                                        <Box marginLeft={2}>
                                            <Text dimColor wrap="truncate-end">
                                                {command.description}
                                            </Text>
                                        </Box>
                                    )}
                            </Box>
                        );
                    })}
            </Box>
        </Box>
    );
}
