/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

export type JsonTheme = {
    readonly boolean: Color;
    readonly bracket: Color;
    readonly key: Color;
    readonly null: Color;
    readonly number: Color;
    readonly string: Color;
};

const DEFAULT_THEME: JsonTheme = {
    boolean: "yellow",
    bracket: "gray",
    key: "cyan",
    null: "gray",
    number: "green",
    string: "yellow",
};

export type Props = {
    /**
     * Accent color for the focused row.
     * @default "blue"
     */
    readonly accentColor?: Color;

    /**
     * Auto-focus for keyboard navigation.
     */
    readonly autoFocus?: boolean;

    /**
     * Depth at which nested containers start collapsed. `0` collapses
     * everything below the root; `Infinity` expands all.
     * @default Infinity
     */
    readonly collapseDepth?: number;

    /**
     * The value to render.
     */
    readonly data: unknown;

    /**
     * When true, arrow keys move a cursor and Space toggles the focused
     * container. When false, the tree renders statically fully expanded down to
     * `collapseDepth`.
     * @default true
     */
    readonly interactive?: boolean;

    /**
     * Color theme for the different JSON token kinds.
     */
    readonly theme?: Partial<JsonTheme>;
};

type Row = {
    readonly collapsible: boolean;
    readonly depth: number;
    readonly id: string;
    readonly key?: string;
    readonly summary?: string;
    readonly value: unknown;
};

const kindOf = (value: unknown): "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined" => {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return "array";
    }

    const type = typeof value;

    if (type === "object" || type === "boolean" || type === "number" || type === "string" || type === "undefined") {
        return type;
    }

    return "string";
};

const isContainer = (value: unknown): boolean => {
    const kind = kindOf(value);

    return kind === "array" || kind === "object";
};

const summarize = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[…${value.length}]`;
    }

    return `{…${Object.keys(value as object).length}}`;
};

/** Depth-first flatten of the value into visible rows, honouring collapse. */
const flatten = (value: unknown, key: string | undefined, depth: number, id: string, collapsed: ReadonlySet<string>, out: Row[]): void => {
    const collapsible = isContainer(value) && (Array.isArray(value) ? value.length > 0 : Object.keys(value as object).length > 0);

    out.push({ collapsible, depth, id, key, summary: collapsible ? summarize(value) : undefined, value });

    if (!collapsible || collapsed.has(id)) {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            flatten(item, String(index), depth + 1, `${id}.${index}`, collapsed, out);
        });

        return;
    }

    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        flatten(childValue, childKey, depth + 1, `${id}.${childKey}`, collapsed, out);
    }
};

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

/**
 * A collapsible JSON viewer. Objects and arrays can be folded; when
 * `interactive`, arrow keys move a cursor and Space toggles the focused
 * container. Values are colored by type.
 */
export default function Json({
    accentColor = "blue",
    autoFocus = false,
    collapseDepth = Number.POSITIVE_INFINITY,
    data,
    interactive = true,
    theme,
}: Props): ReactElement {
    const palette: JsonTheme = { ...DEFAULT_THEME, ...theme };
    const { isFocused } = useFocus({ autoFocus, isActive: interactive });

    const initialCollapsed = useMemo(() => {
        const set = new Set<string>();
        const walk = (value: unknown, depth: number, id: string): void => {
            if (!isContainer(value)) {
                return;
            }

            if (depth >= collapseDepth) {
                set.add(id);
            }

            const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as object);

            for (const [childKey, childValue] of entries) {
                walk(childValue, depth + 1, `${id}.${childKey}`);
            }
        };

        walk(data, 0, "$");

        return set;
    }, [collapseDepth, data]);

    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(initialCollapsed);
    const [cursor, setCursor] = useState(0);

    const rows = useMemo(() => {
        const out: Row[] = [];

        flatten(data, undefined, 0, "$", collapsed, out);

        return out;
    }, [collapsed, data]);

    const toggle = useCallback((id: string) => {
        setCollapsed((current) => {
            const next = new Set(current);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }, []);

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; leftArrow: boolean; rightArrow: boolean; upArrow: boolean }) => {
            if (key.upArrow) {
                setCursor((index) => wrap(index - 1, rows.length));

                return;
            }

            if (key.downArrow) {
                setCursor((index) => wrap(index + 1, rows.length));

                return;
            }

            const row = rows[cursor];

            if (!row?.collapsible) {
                return;
            }

            const expand = key.rightArrow && collapsed.has(row.id);
            const collapse = key.leftArrow && !collapsed.has(row.id);

            if (input === " " || expand || collapse) {
                toggle(row.id);
            }
        },
        [collapsed, cursor, rows, toggle],
    );

    useInput(inputHandler, { isActive: interactive && isFocused });

    const renderValue = (row: Row): ReactElement => {
        if (row.collapsible) {
            const marker = collapsed.has(row.id) ? "▸" : "▾";

            return (
                <Text color={palette.bracket}>
                    {marker}
                    {" "}
                    {row.summary}
                </Text>
            );
        }

        const kind = kindOf(row.value);

        // Empty containers are not collapsible, so they reach here — render them
        // as `[]`/`{}` rather than falling through to the null branch.
        if (kind === "array" || kind === "object") {
            return <Text color={palette.bracket}>{kind === "array" ? "[]" : "{}"}</Text>;
        }

        if (kind === "string") {
            return <Text color={palette.string}>{JSON.stringify(row.value)}</Text>;
        }

        if (kind === "number") {
            return <Text color={palette.number}>{String(row.value)}</Text>;
        }

        if (kind === "boolean") {
            return <Text color={palette.boolean}>{String(row.value)}</Text>;
        }

        return <Text color={palette.null}>{row.value === undefined ? "undefined" : "null"}</Text>;
    };

    return (
        <Box flexDirection="column">
            {rows.map((row, index) => {
                const isActive = interactive && isFocused && index === cursor;

                return (
                    <Box key={row.id}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯" : " "}</Text>
                        <Text>{"  ".repeat(row.depth)}</Text>
                        {row.key === undefined
                            ? undefined
                            : (
                            <Text color={palette.key}>
                                {row.key}
                                :
                                {" "}
                            </Text>
                            )}
                        {renderValue(row)}
                    </Box>
                );
            })}
        </Box>
    );
}

export { Json };
export type { Props as JsonProps };
