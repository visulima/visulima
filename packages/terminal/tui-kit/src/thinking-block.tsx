/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Accent color for the header and border.
     * @default "magenta"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus so Space/Enter can toggle the block.
     */
    readonly autoFocus?: boolean;

    /**
     * The reasoning text.
     */
    readonly children: string;

    /**
     * Start expanded when uncontrolled.
     * @default true
     */
    readonly defaultExpanded?: boolean;

    /**
     * Controlled expanded state. When set, `defaultExpanded` is ignored.
     */
    readonly expanded?: boolean;

    /**
     * Header label.
     * @default "Thinking"
     */
    readonly label?: string;

    /**
     * Fires when the expanded state toggles.
     */
    readonly onToggle?: (expanded: boolean) => void;

    /**
     * Show a pulsing indicator to signal in-progress reasoning.
     * @default false
     */
    readonly streaming?: boolean;
};

/**
 * A collapsible block for an assistant's reasoning. The dimmed body is hidden
 * when collapsed; Space or Enter toggles it while focused. Set `streaming` to
 * mark reasoning still in progress.
 */
export default function ThinkingBlock({
    accentColor = "magenta",
    autoFocus = false,
    children,
    defaultExpanded = true,
    expanded: controlledExpanded,
    label = "Thinking",
    onToggle,
    streaming = false,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus });
    const isControlled = controlledExpanded !== undefined;

    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const expanded = controlledExpanded ?? internalExpanded;

    const toggle = useCallback(() => {
        const next = !expanded;

        if (!isControlled) {
            setInternalExpanded(next);
        }

        onToggle?.(next);
    }, [expanded, isControlled, onToggle]);

    const inputHandler = useCallback(
        (input: string, key: { return: boolean }) => {
            if (input === " " || key.return) {
                toggle();
            }
        },
        [toggle],
    );

    useInput(inputHandler, { isActive: isFocused });

    return (
        <Box borderColor={accentColor} borderStyle="round" flexDirection="column" paddingX={1}>
            <Box gap={1}>
                <Text color={accentColor}>{expanded ? "▾" : "▸"}</Text>
                <Text color={accentColor} italic>
                    {label}
                </Text>
                {streaming ? <Text color={accentColor}>…</Text> : undefined}
                {isFocused ? <Text dimColor>{expanded ? "(space to collapse)" : "(space to expand)"}</Text> : undefined}
            </Box>
            {expanded
                ? (
                <Box marginTop={1}>
                    <Text dimColor italic>
                        {children}
                    </Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { ThinkingBlock };
export type { Props as ThinkingBlockProps };
