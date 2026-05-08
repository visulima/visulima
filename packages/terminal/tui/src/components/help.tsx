import type { ReactElement, ReactNode } from "react";

import type { KeyBinding } from "../ink/hooks/use-key-bindings";
import useWindowSize from "../ink/hooks/use-window-size";
import Box from "./box";
import Text from "./text";

/**
 * Human-readable labels for special key names.
 */
const keyLabels: Record<string, string> = {
    backspace: "backspace",
    delete: "del",
    downArrow: "\u2193",
    end: "end",
    escape: "esc",
    home: "home",
    leftArrow: "\u2190",
    pageDown: "pgdn",
    pageUp: "pgup",
    return: "enter",
    rightArrow: "\u2192",
    tab: "tab",
    upArrow: "\u2191",
};

/**
 * Format a key spec string into a human-readable label.
 * `"ctrl+c"` -> `"ctrl+c"`, `"upArrow"` -> `"\u2191"`, `"q"` -> `"q"`
 */
function formatKeyLabel(spec: string): string {
    const plusIndex = spec.indexOf("+");

    if (plusIndex !== -1) {
        const modifier = spec.slice(0, plusIndex);
        const rest = spec.slice(plusIndex + 1);

        return `${modifier}+${keyLabels[rest] ?? rest}`;
    }

    return keyLabels[spec] ?? spec;
}

/**
 * Format all keys of a binding into a single display string.
 * `["upArrow", "k"]` -> `"\u2191/k"`
 */
function formatKeys(key: string | ReadonlyArray<string>): string {
    const keys = typeof key === "string" ? [key] : key;

    return keys.map((k) => formatKeyLabel(k)).join("/");
}

export type Props = {
    /**
     * Key bindings to display. Typically the `bindings` array returned by `useKeyBindings`.
     */
    readonly bindings: ReadonlyArray<KeyBinding>;

    /**
     * Color for description text.
     * @default undefined (uses dimColor)
     */
    readonly descriptionColor?: string;

    /**
     * Color for key labels.
     * @default "cyan"
     */
    readonly keyColor?: string;

    /**
     * Maximum number of columns in full mode.
     * @default 3
     */
    readonly maxColumns?: number;

    /**
     * Display mode.
     * - `"short"`: Single-line horizontal bar, truncated to terminal width.
     * - `"full"`: Multi-column layout grouped by `group` field.
     * @default "short"
     */
    readonly mode?: "full" | "short";

    /**
     * Separator between key-description pairs in short mode.
     * @default " \u00b7 "
     */
    readonly separator?: string;
};

/**
 * Renders a keybinding help bar from an array of `KeyBinding` definitions.
 *
 * ```tsx
 * &lt;Help bindings={bindings} />
 * &lt;Help bindings={bindings} mode="full" />
 * ```
 */
export default function Help({ bindings, descriptionColor, keyColor = "cyan", maxColumns = 3, mode = "short", separator = " \u00B7 " }: Props): ReactElement {
    const { columns } = useWindowSize();

    if (mode === "full") {
        return renderFull(bindings, { columns, descriptionColor, keyColor, maxColumns });
    }

    return renderShort(bindings, { columns, descriptionColor, keyColor, separator });
}

function renderShort(
    bindings: ReadonlyArray<KeyBinding>,
    options: { columns: number; descriptionColor: string | undefined; keyColor: string; separator: string },
): ReactElement {
    const items: ReactNode[] = [];
    let totalWidth = 0;

    for (const [index, binding] of bindings.entries()) {
        const keys = formatKeys(binding.key);
        const pairText = `${keys} ${binding.description}`;
        const separatorWidth = index > 0 ? options.separator.length : 0;
        const pairWidth = separatorWidth + pairText.length;

        // Stop if adding this pair would exceed terminal width
        if (totalWidth + pairWidth > options.columns && items.length > 0) {
            break;
        }

        if (index > 0) {
            items.push(
                <Text dimColor key={`sep-${index}`}>
                    {options.separator}
                </Text>,
            );
        }

        items.push(
            <Box key={`pair-${index}`}>
                <Text color={options.keyColor}>{keys}</Text>
                <Text> </Text>
                {options.descriptionColor ? <Text color={options.descriptionColor}>{binding.description}</Text> : <Text dimColor>{binding.description}</Text>}
            </Box>,
        );

        totalWidth += pairWidth;
    }

    return <Box flexDirection="row">{items}</Box>;
}

function renderFull(
    bindings: ReadonlyArray<KeyBinding>,
    options: { columns: number; descriptionColor: string | undefined; keyColor: string; maxColumns: number },
): ReactElement {
    // Group bindings
    const groups = new Map<string, KeyBinding[]>();

    for (const binding of bindings) {
        const group = binding.group ?? "";

        if (!groups.has(group)) {
            groups.set(group, []);
        }

        groups.get(group)!.push(binding);
    }

    const groupEntries = [...groups.entries()];
    const columnCount = Math.min(options.maxColumns, groupEntries.length || 1);
    const columnWidth = Math.floor(options.columns / columnCount);

    const columnNodes: ReactNode[] = [];

    for (const [index, [groupName, groupBindings]] of groupEntries.entries()) {
        const rows: ReactNode[] = [];

        if (groupName) {
            rows.push(
                <Text bold key="title">
                    {groupName}
                </Text>,
            );
        }

        for (const [bIndex, binding] of groupBindings.entries()) {
            const keys = formatKeys(binding.key);

            rows.push(
                <Box key={`b-${bIndex}`}>
                    <Text color={options.keyColor}>{keys}</Text>
                    <Text> </Text>
                    {options.descriptionColor ? (
                        <Text color={options.descriptionColor}>{binding.description}</Text>
                    ) : (
                        <Text dimColor>{binding.description}</Text>
                    )}
                </Box>,
            );
        }

        columnNodes.push(
            <Box flexDirection="column" key={`col-${index}`} width={columnWidth}>
                {rows}
            </Box>,
        );
    }

    return <Box flexDirection="row">{columnNodes}</Box>;
}

export { Help };
export type { Props as HelpProps };
