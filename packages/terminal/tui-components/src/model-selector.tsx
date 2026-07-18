/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type ModelOption = {
    /**
     * Optional context-window hint shown on the right (e.g. `200k`).
     */
    readonly context?: string;
    readonly id: string;
    readonly name: string;
    readonly provider?: string;
};

export type Props = {
    /**
     * Accent color for the focused row and selected marker.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Selected model id when uncontrolled.
     */
    readonly defaultValue?: string;

    /**
     * The models to choose from.
     */
    readonly models: ReadonlyArray<ModelOption>;

    /**
     * Fires when the highlighted model is committed with Enter.
     */
    readonly onSelect?: (model: ModelOption) => void;

    /**
     * Controlled selected model id. When set, `defaultValue` is ignored.
     */
    readonly value?: string;
};

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

/**
 * A selectable list of models with provider and context-window hints. ↑/↓ move
 * the cursor and Enter commits; a ● marks the currently-selected model.
 */
export default function ModelSelector({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    models,
    onSelect,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState(defaultValue);
    const selectedId = controlledValue ?? internal;

    const startIndex = Math.max(0, models.findIndex((model) => model.id === selectedId));
    const [cursor, setCursor] = useState(startIndex);

    const inputHandler = useCallback(
        (_input: string, key: { downArrow: boolean; return: boolean; upArrow: boolean }) => {
            if (key.upArrow) {
                setCursor((index) => wrap(index - 1, models.length));

                return;
            }

            if (key.downArrow) {
                setCursor((index) => wrap(index + 1, models.length));

                return;
            }

            if (key.return) {
                const model = models[cursor];

                if (model !== undefined) {
                    if (!isControlled) {
                        setInternal(model.id);
                    }

                    onSelect?.(model);
                }
            }
        },
        [cursor, isControlled, models, onSelect],
    );

    useInput(inputHandler, { isActive: isFocused });

    return (
        <Box flexDirection="column">
            {models.map((model, index) => {
                const isActive = isFocused && index === cursor;
                const isSelected = model.id === selectedId;

                return (
                    <Box gap={1} key={model.id}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯" : " "}</Text>
                        <Text color={isSelected ? accentColor : undefined}>{isSelected ? "●" : "○"}</Text>
                        <Text bold={isActive}>{model.name}</Text>
                        {model.provider === undefined ? undefined : <Text dimColor>{model.provider}</Text>}
                        {model.context === undefined
                            ? undefined
                            : (
                            <Box marginLeft={1}>
                                <Text dimColor>{model.context}</Text>
                            </Box>
                            )}
                    </Box>
                );
            })}
        </Box>
    );
}

export { ModelSelector };
export type { Props as ModelSelectorProps };
