/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

const EMPTY_TAGS: ReadonlyArray<string> = [];

export type Props = {
    /**
     * Accent color for the chips and focused border.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Reject duplicate tags (case-sensitive).
     * @default true
     */
    readonly dedupe?: boolean;

    /**
     * Tags present when uncontrolled.
     */
    readonly defaultValue?: ReadonlyArray<string>;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Maximum number of tags. Further input is ignored once reached.
     */
    readonly max?: number;

    /**
     * Fires whenever the set of tags changes.
     */
    readonly onChange?: (tags: ReadonlyArray<string>) => void;

    /**
     * Fires on Enter with an empty draft (i.e. "done adding tags").
     */
    readonly onSubmit?: (tags: ReadonlyArray<string>) => void;

    /**
     * Placeholder shown when there are no tags and no draft.
     * @default "Add tags…"
     */
    readonly placeholder?: string;

    /**
     * Besides Enter, which typed characters commit the current draft (default comma and space).
     */
    readonly separators?: ReadonlyArray<string>;

    /**
     * Controlled tags. When provided, `defaultValue` is ignored.
     */
    readonly value?: ReadonlyArray<string>;
};

const DEFAULT_SEPARATORS: ReadonlyArray<string> = [",", " "];

/**
 * A chip-style multi-value input. Type a tag and press Enter (or a separator)
 * to commit it; Backspace on an empty draft removes the last tag. Renders each
 * committed value as a colored chip followed by the live draft.
 */
export default function TagInput({
    accentColor = "blue",
    autoFocus = false,
    dedupe = true,
    defaultValue = EMPTY_TAGS,
    isDisabled = false,
    max,
    onChange,
    onSubmit,
    placeholder = "Add tags…",
    separators = DEFAULT_SEPARATORS,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState<ReadonlyArray<string>>(defaultValue);
    const [draft, setDraft] = useState("");

    const tags = controlledValue ?? internal;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const setTags = useCallback(
        (next: ReadonlyArray<string>) => {
            if (!isControlled) {
                setInternal(next);
            }

            onChangeRef.current?.(next);
        },
        [isControlled],
    );

    const commitDraft = useCallback(
        (raw: string) => {
            const trimmed = raw.trim();

            if (trimmed.length === 0) {
                return;
            }

            if (max !== undefined && tags.length >= max) {
                return;
            }

            if (dedupe && tags.includes(trimmed)) {
                setDraft("");

                return;
            }

            setTags([...tags, trimmed]);
            setDraft("");
        },
        [dedupe, max, setTags, tags],
    );

    const inputHandler = useCallback(
        (input: string, key: { backspace: boolean; delete: boolean; return: boolean }) => {
            if (key.return) {
                if (draft.trim().length > 0) {
                    commitDraft(draft);
                } else {
                    onSubmit?.(tags);
                }

                return;
            }

            if ((key.backspace || key.delete) && draft.length === 0) {
                if (tags.length > 0) {
                    setTags(tags.slice(0, -1));
                }

                return;
            }

            if (key.backspace || key.delete) {
                setDraft(draft.slice(0, -1));

                return;
            }

            if (separators.includes(input)) {
                commitDraft(draft);

                return;
            }

            // Ignore control bytes; accept printable input.
            if (input.length > 0 && input.codePointAt(0)! >= 0x20) {
                setDraft(`${draft}${input}`);
            }
        },
        [commitDraft, draft, onSubmit, separators, setTags, tags],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    const isEmpty = tags.length === 0 && draft.length === 0;

    return (
        <Box borderColor={isFocused ? accentColor : undefined} borderStyle="round" flexWrap="wrap" gap={1} paddingX={1}>
            {tags.map((tag, index) => (
                // eslint-disable-next-line react-x/no-array-index-key -- tag index is stable for the render
                <Text backgroundColor={accentColor} key={index}>
                    {` ${tag} `}
                </Text>
            ))}
            {isEmpty ? <Text dimColor>{placeholder}</Text> : <Text>{draft}</Text>}
            {isFocused && !isEmpty ? <Text color={accentColor}>▏</Text> : undefined}
        </Box>
    );
}

export { TagInput };
export type { Props as TagInputProps };
