import { useCallback, useRef } from "react";

import type { Key } from "./use-input";
import useInput from "./use-input";

// eslint-disable-next-line sonarjs/redundant-type-aliases -- semantic alias documents that strings are interpreted as chord steps
export type KeyChordStep = string;

export type UseKeyChordOptions = {
    /**
     * Disable the chord while keeping the component rendered.
     * @default true
     */
    readonly isActive?: boolean;

    /**
     * Milliseconds of silence after which the partial chord resets.
     * @default 1000
     */
    readonly resetAfter?: number;
};

/**
 * Resolve the bare key name (no modifiers) for a given input event.
 */
const resolveKeyName = (input: string, key: Key): string | undefined => {
    if (key.escape) {
        return "escape";
    }

    if (key.return) {
        return "return";
    }

    if (key.tab) {
        return "tab";
    }

    if (key.backspace) {
        return "backspace";
    }

    if (key.delete) {
        return "delete";
    }

    if (key.home) {
        return "home";
    }

    if (key.end) {
        return "end";
    }

    if (key.pageUp) {
        return "pageup";
    }

    if (key.pageDown) {
        return "pagedown";
    }

    if (key.upArrow) {
        return "up";
    }

    if (key.downArrow) {
        return "down";
    }

    if (key.leftArrow) {
        return "left";
    }

    if (key.rightArrow) {
        return "right";
    }

    if (input === " ") {
        return "space";
    }

    if (!input || input.length === 0) {
        return undefined;
    }

    return input;
};

/**
 * Convert a parsed key event into a canonical chord token. Modifiers are
 * prefixed in a stable order (`ctrl+meta+shift+key`) so chord strings can be
 * compared character-for-character against `useHotkey`-style tokens.
 */
const keyToString = (input: string, key: Key): string | undefined => {
    const name = resolveKeyName(input, key);

    if (name === undefined) {
        return undefined;
    }

    const parts: string[] = [];

    if (key.ctrl) {
        parts.push("ctrl");
    }

    if (key.meta) {
        parts.push("meta");
    }

    if (key.shift) {
        parts.push("shift");
    }

    parts.push(name);

    return parts.join("+");
};

const normalizeStep = (step: KeyChordStep): string => step.trim().toLowerCase();

/**
 * Invoke `callback` when the user types the given sequence of keys in order
 * (like Vim's `g d` or Emacs's `C-x C-s`). The chord resets automatically
 * after `resetAfter` ms of silence.
 * @param sequence Ordered list of chord steps. Each step is compared against
 * a canonical key token (e.g. `"g"`, `"space"`, `"ctrl+s"`).
 * @param callback Invoked exactly once per successful chord match. Latest
 * reference is captured in a ref.
 * @param options Optional `isActive` flag and `resetAfter` silence timeout.
 */
const useKeyChord = (sequence: ReadonlyArray<KeyChordStep>, callback: () => void, options?: UseKeyChordOptions): void => {
    const { isActive = true, resetAfter = 1000 } = options ?? {};
    const progressRef = useRef(0);
    const lastStepAtRef = useRef(0);
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    useInput(
        useCallback(
            (input, key) => {
                const now = Date.now();

                if (resetAfter > 0 && progressRef.current > 0 && now - lastStepAtRef.current > resetAfter) {
                    progressRef.current = 0;
                }

                const pressed = keyToString(input, key);

                if (pressed === undefined || sequence.length === 0) {
                    return;
                }

                const expected = sequence[progressRef.current];

                if (expected === undefined) {
                    progressRef.current = 0;

                    return;
                }

                if (normalizeStep(pressed) === normalizeStep(expected)) {
                    progressRef.current += 1;
                    lastStepAtRef.current = now;

                    if (progressRef.current >= sequence.length) {
                        progressRef.current = 0;
                        callbackRef.current();
                    }

                    return;
                }

                // Key didn't match; reset but try matching the first step with
                // the new input to support repeated prefixes (e.g. typing `g g g`).
                progressRef.current = 0;

                if (normalizeStep(pressed) === normalizeStep(sequence[0] ?? "")) {
                    progressRef.current = 1;
                    lastStepAtRef.current = now;
                }
            },
            [sequence, resetAfter],
        ),
        { isActive },
    );
};

export default useKeyChord;

export { useKeyChord };
