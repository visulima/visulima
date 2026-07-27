/* eslint-disable react/function-component-definition */
import { readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

const TRAILING_SLASH = /\/$/;

/**
 * Default completer: list entries of the directory portion of `input` whose
 * basename starts with the typed leaf. Directories get a trailing separator.
 * Any filesystem error yields no completions rather than throwing.
 */
const listPathCompletions = (input: string): ReadonlyArray<string> => {
    const directory = input.endsWith("/") ? input : dirname(input);
    const leaf = input.endsWith("/") ? "" : basename(input);

    try {
        return readdirSync(directory.length === 0 ? "." : directory)
            .filter((entry) => entry.startsWith(leaf))
            .map((entry) => {
                const full = join(directory, entry);

                try {
                    return statSync(full).isDirectory() ? `${full}/` : full;
                } catch {
                    return full;
                }
            })
            .toSorted((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
};

export type Props = {
    /**
     * Accent color for the focused border and caret.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial path when uncontrolled.
     */
    readonly defaultValue?: string;

    /**
     * Override how completions are produced (e.g. to sandbox or mock the
     * filesystem). Defaults to reading the real filesystem.
     */
    readonly getCompletions?: (input: string) => ReadonlyArray<string>;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Fires whenever the path text changes.
     */
    readonly onChange?: (path: string) => void;

    /**
     * Fires on Enter with the current path.
     */
    readonly onSubmit?: (path: string) => void;

    /**
     * Placeholder shown when empty.
     * @default "Enter a path…"
     */
    readonly placeholder?: string;

    /**
     * Show the first few completion candidates beneath the field.
     * @default true
     */
    readonly showSuggestions?: boolean;

    /**
     * Controlled path. When provided, `defaultValue` is ignored.
     */
    readonly value?: string;
};

const MAX_SUGGESTIONS = 5;

/**
 * A text input specialised for filesystem paths. Tab completes against the
 * directory being typed (cycling through matches on repeated presses), and a
 * short list of candidates is shown below the field.
 */
export default function PathInput({
    accentColor = "blue",
    autoFocus = false,
    defaultValue = "",
    getCompletions = listPathCompletions,
    isDisabled = false,
    onChange,
    onSubmit,
    placeholder = "Enter a path…",
    showSuggestions = true,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState(defaultValue);
    const path = controlledValue ?? internal;

    // The completion candidates frozen at the first Tab, cycled on repeat
    // presses. Reset to null on any edit so the next Tab re-snapshots.
    const cycleRef = useRef<{ index: number; matches: ReadonlyArray<string> } | null>(null);

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const completions = useMemo(() => getCompletions(path), [getCompletions, path]);

    const setPath = useCallback(
        (next: string) => {
            if (!isControlled) {
                setInternal(next);
            }

            onChangeRef.current?.(next);
        },
        [isControlled],
    );

    const inputHandler = useCallback(
        (input: string, key: { backspace: boolean; delete: boolean; return: boolean; tab: boolean }) => {
            if (key.tab) {
                // Snapshot the candidate list on the first Tab, then cycle the
                // frozen list — recomputing from `path` each press would collapse
                // to the just-picked entry and never advance.
                cycleRef.current ??= { index: 0, matches: completions };

                const { index, matches } = cycleRef.current;

                if (matches.length > 0) {
                    cycleRef.current = { index: index + 1, matches };
                    setPath(matches[index % matches.length]!);
                }

                return;
            }

            if (key.return) {
                onSubmit?.(path);

                return;
            }

            if (key.backspace || key.delete) {
                cycleRef.current = null;
                setPath(path.slice(0, -1));

                return;
            }

            if (input.length > 0 && input.codePointAt(0)! >= 0x20) {
                cycleRef.current = null;
                setPath(`${path}${input}`);
            }
        },
        [completions, onSubmit, path, setPath],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    return (
        <Box flexDirection="column">
            <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" paddingX={1}>
                <Text color={accentColor}>📁 </Text>
                {path.length === 0 ? <Text dimColor>{placeholder}</Text> : <Text dimColor={isDisabled}>{path}</Text>}
                {isFocused && path.length > 0 ? <Text color={accentColor}>▏</Text> : undefined}
            </Box>
            {/* eslint-disable-next-line @stylistic/multiline-ternary -- prettier formats JSX ternaries on one line */}
            {showSuggestions && isFocused && completions.length > 0 ? (
                <Box flexDirection="column" marginLeft={1}>
                    {completions.slice(0, MAX_SUGGESTIONS).map((candidate, index) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- candidate index is stable for the render
                        <Text dimColor key={index}>
                            {basename(candidate.replace(TRAILING_SLASH, ""))}
                            {candidate.endsWith("/") ? "/" : ""}
                        </Text>
                    ))}
                    {completions.length > MAX_SUGGESTIONS ? <Text dimColor>{`…and ${completions.length - MAX_SUGGESTIONS} more`}</Text> : undefined}
                </Box>
            ) : undefined}
        </Box>
    );
}

export { PathInput };
export type { Props as PathInputProps };
