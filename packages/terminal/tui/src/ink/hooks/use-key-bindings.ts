import { useCallback, useMemo, useRef } from "react";

import type { Key } from "./use-input";
import useInput from "./use-input";

/**
 * A single key binding definition.
 */
export type KeyBinding = {
    /** Human-readable description shown in Help. */
    readonly description: string;

    /**
     * Whether this binding is active.
     * @default true
     */
    readonly enabled?: boolean;

    /** Optional group name for organizing in the Help component's full mode. */
    readonly group?: string;

    /**
     * Key(s) that trigger this binding.
     *
     * A string can be:
     * - A single character: `"q"`, `"a"`, `" "` (space)
     * - A `Key` boolean field name: `"return"`, `"escape"`, `"upArrow"`, `"leftArrow"`, etc.
     * - A modifier combo: `"ctrl+c"`, `"meta+s"` (modifier + character)
     *
     * Provide an array to match multiple keys for the same action.
     */
    readonly key: string | ReadonlyArray<string>;
};

/**
 * A binding paired with its handler function.
 */
export type KeyBindingHandler = {
    readonly binding: KeyBinding;
    readonly handler: () => void;
};

type UseKeyBindingsOptions = {
    /**
     * Whether keyboard input is captured.
     * @default true
     */
    readonly isActive?: boolean;
};

type UseKeyBindingsResult = {
    /** The enabled bindings, suitable for passing to the Help component. */
    readonly bindings: ReadonlyArray<KeyBinding>;
};

// Key fields on the Key type that represent boolean special keys
const specialKeyFields = new Set<string>([
    "backspace",
    "delete",
    "downArrow",
    "end",
    "escape",
    "home",
    "leftArrow",
    "pageDown",
    "pageUp",
    "return",
    "rightArrow",
    "tab",
    "upArrow",
]);

// Modifier fields on the Key type
const modifierFields = new Set<string>(["ctrl", "hyper", "meta", "shift", "super"]);

/**
 * Check whether a single key spec matches the current input event.
 */
function matchesKey(spec: string, input: string, key: Key): boolean {
    // Modifier combo: "ctrl+c", "meta+s", etc.
    const plusIndex = spec.indexOf("+");

    if (plusIndex !== -1) {
        const modifier = spec.slice(0, plusIndex);
        const rest = spec.slice(plusIndex + 1);

        if (!modifierFields.has(modifier)) {
            return false;
        }

        // Check modifier is active
        if (!(key as Record<string, unknown>)[modifier]) {
            return false;
        }

        // The rest can be a special key or a character
        if (specialKeyFields.has(rest)) {
            return (key as Record<string, unknown>)[rest] === true;
        }

        return input === rest;
    }

    // Special key field: "return", "escape", "upArrow", etc.
    if (specialKeyFields.has(spec)) {
        return (key as Record<string, unknown>)[spec] === true;
    }

    // Plain character match
    return input === spec;
}

/**
 * Declarative keybinding hook. Registers multiple key bindings with handlers
 * and returns the enabled bindings for display in a Help component.
 *
 * ```tsx
 * const { bindings } = useKeyBindings([
 *   { binding: { key: "q", description: "Quit" }, handler: () => exit() },
 *   { binding: { key: ["upArrow", "k"], description: "Move up" }, handler: () => moveUp() },
 *   { binding: { key: "ctrl+s", description: "Save" }, handler: () => save() },
 * ]);
 *
 * &lt;Help bindings={bindings} />
 * ```
 */
export default function useKeyBindings(handlers: ReadonlyArray<KeyBindingHandler>, options?: UseKeyBindingsOptions): UseKeyBindingsResult {
    const { isActive = true } = options ?? {};

    const handlersRef = useRef(handlers);

    handlersRef.current = handlers;

    useInput(
        useCallback((input: string, key: Key) => {
            for (const { binding, handler } of handlersRef.current) {
                if (binding.enabled === false) {
                    continue;
                }

                const keys = typeof binding.key === "string" ? [binding.key] : binding.key;

                for (const k of keys) {
                    if (matchesKey(k, input, key)) {
                        handler();

                        return;
                    }
                }
            }
        }, []),
        { isActive },
    );

    const bindings = useMemo(() => handlers.filter((h) => h.binding.enabled !== false).map((h) => h.binding), [handlers]);

    return { bindings };
}

export { useKeyBindings };
