import { useCallback } from "react";

import type { Key } from "./use-input";
import useInput from "./use-input";

export type HotkeyDescriptor = {
    /**
     * Whether Ctrl must be held.
     */
    readonly ctrl?: boolean;

    /**
     * Character(s) to match after modifiers, e.g. `"s"`, `"?"`, `"k"`.
     * Ignored if `name` is set.
     */
    readonly input?: string;

    /**
     * Whether Meta must be held.
     */
    readonly meta?: boolean;

    /**
     * Named special key, e.g. `"escape"`, `"return"`, `"tab"`, `"upArrow"`.
     */
    readonly name?: keyof Key;

    /**
     * Whether Shift must be held.
     */
    readonly shift?: boolean;
};

export type UseHotkeyOptions = {
    /**
     * Disable the binding while keeping the component rendered.
     * @default true
     */
    readonly isActive?: boolean;
};

const NAMED_KEYS = new Set<keyof Key>([
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

/**
 * Parse a short string hotkey like `"ctrl+s"`, `"shift+tab"`, `"?"`, `"escape"`.
 */
const parseShortcut = (shortcut: string): HotkeyDescriptor => {
    const parts = shortcut
        .split("+")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    const descriptor: { ctrl?: boolean; input?: string; meta?: boolean; name?: keyof Key; shift?: boolean } = {};

    for (const part of parts) {
        const lower = part.toLowerCase();

        switch (lower) {
            case "alt":
            case "cmd":
            case "meta": {
                descriptor.meta = true;

                break;
            }
            case "control":
            case "ctrl": {
                descriptor.ctrl = true;

                break;
            }
            case "shift": {
                descriptor.shift = true;

                break;
            }
            default: {
                if (NAMED_KEYS.has(lower as keyof Key)) {
                    descriptor.name = lower as keyof Key;
                } else {
                    switch (lower) {
                        case "down": {
                            descriptor.name = "downArrow";

                            break;
                        }
                        case "enter": {
                            descriptor.name = "return";

                            break;
                        }
                        case "esc": {
                            descriptor.name = "escape";

                            break;
                        }
                        case "left": {
                            descriptor.name = "leftArrow";

                            break;
                        }
                        case "right": {
                            descriptor.name = "rightArrow";

                            break;
                        }
                        case "up": {
                            descriptor.name = "upArrow";

                            break;
                        }
                        default: {
                            descriptor.input = part;
                        }
                    }
                }
            }
        }
    }

    return descriptor;
};

const matches = (descriptor: HotkeyDescriptor, input: string, key: Key): boolean => {
    if (descriptor.ctrl !== undefined && descriptor.ctrl !== key.ctrl) {
        return false;
    }

    if (descriptor.shift !== undefined && descriptor.shift !== key.shift) {
        return false;
    }

    if (descriptor.meta !== undefined && descriptor.meta !== key.meta) {
        return false;
    }

    if (descriptor.name !== undefined) {
        return Boolean(key[descriptor.name]);
    }

    if (descriptor.input !== undefined) {
        return input === descriptor.input;
    }

    return false;
};

/**
 * Bind a keyboard shortcut to a callback. Accepts either a short string
 * (`"ctrl+s"`, `"?"`, `"escape"`) or a structured descriptor.
 */
const useHotkey = (shortcut: HotkeyDescriptor | string, callback: () => void, options?: UseHotkeyOptions): void => {
    const descriptor = typeof shortcut === "string" ? parseShortcut(shortcut) : shortcut;

    useInput(
        useCallback(
            (input, key) => {
                if (matches(descriptor, input, key)) {
                    callback();
                }
            },

            [shortcut, callback],
        ),
        { isActive: options?.isActive ?? true },
    );
};

export default useHotkey;

export { useHotkey };
