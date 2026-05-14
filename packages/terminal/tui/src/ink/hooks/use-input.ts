/* eslint-disable consistent-return, e18e/prefer-static-regex */
import { useEffect, useEffectEvent, useRef } from "react";

import { IMECompositionBuffer, isIMEInput } from "../ime-utils";
import parseKeypress, { nonAlphanumericKeys } from "../parse-keypress";
import reconciler from "../reconciler";
import { useStdinContext } from "./use-stdin";

/**
 * Handy information about a key that was pressed.
 */
export type Key = {
    /**
     * Backspace key was pressed.
     */
    backspace: boolean;

    /**
     * Caps Lock is active.
     *
     * Only available with kitty keyboard protocol.
     */
    capsLock: boolean;

    /**
     * Ctrl key was pressed.
     */
    ctrl: boolean;

    /**
     * Delete key was pressed.
     */
    delete: boolean;

    /**
     * Down arrow key was pressed.
     */
    downArrow: boolean;

    /**
     * End key was pressed.
     */
    end: boolean;

    /**
     * Escape key was pressed.
     */
    escape: boolean;

    /**
     * Event type for key events.
     *
     * Only available with kitty keyboard protocol.
     */
    eventType?: "press" | "repeat" | "release";

    /**
     * Home key was pressed.
     */
    home: boolean;

    /**
     * Hyper key was pressed.
     *
     * Only available with kitty keyboard protocol.
     */
    hyper: boolean;

    /**
     * Left arrow key was pressed.
     */
    leftArrow: boolean;

    /**
     * [Meta key](https://en.wikipedia.org/wiki/Meta_key) was pressed.
     */
    meta: boolean;

    /**
     * Num Lock is active.
     *
     * Only available with kitty keyboard protocol.
     */
    numLock: boolean;

    /**
     * Page Down key was pressed.
     */
    pageDown: boolean;

    /**
     * Page Up key was pressed.
     */
    pageUp: boolean;

    /**
     * Return (Enter) key was pressed.
     */
    return: boolean;

    /**
     * Right arrow key was pressed.
     */
    rightArrow: boolean;

    /**
     * Shift key was pressed.
     */
    shift: boolean;

    /**
     * Super key (Cmd on Mac, Win on Windows) was pressed.
     *
     * Only available with kitty keyboard protocol.
     */
    super: boolean;

    /**
     * Tab key was pressed.
     */
    tab: boolean;

    /**
     * Up arrow key was pressed.
     */
    upArrow: boolean;
};

type Handler = (input: string, key: Key) => void;

type Options = {
    /**
     * Enable IME (Input Method Editor) composition buffering for Vietnamese, Chinese,
     * Japanese, Korean, and other non-ASCII input methods.
     * @default true
     */
    imeEnabled?: boolean;

    /**
     * Timeout in milliseconds to wait before flushing IME composition buffer.
     * @default 50
     */
    imeTimeout?: number;

    /**
     * Enable or disable capturing of user input. Useful when there are multiple `useInput` hooks used at once to avoid handling the same input several times.
     * @default true
     */
    isActive?: boolean;
};

/**
 * A React hook that returns `void` and handles user input.
 * It's a more convenient alternative to using `StdinContext` and listening for
 * `data` events. The callback you pass to `useInput` is called for typed
 * characters and key events.
 *
 * Bracketed paste payloads belong to `usePaste`. If no `usePaste` handler is
 * active, Ink still forwards bracketed paste text to `useInput` for backward
 * compatibility, but that fallback is deprecated and will be removed in the next
 * major version.
 *
 * ```
 * import {useInput} from '@visulima/tui/hooks/use-input';
 *
 * const UserInput = () => {
 * useInput((input, key) => {
 * if (input === 'q') {
 * // Exit program
 * }
 *
 * if (key.leftArrow) {
 * // Left arrow key pressed
 * }
 * });
 *
 * return …
 * };
 * ```
 */
const useInput = (inputHandler: Handler, options: Options = {}): void => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { internal_eventEmitter, internal_exitOnCtrlC, setRawMode, stdin } = useStdinContext();

    const imeEnabled = options.imeEnabled ?? true;
    const imeTimeout = options.imeTimeout ?? 50;

    // IME composition buffer ref
    const imeBufferRef = useRef<IMECompositionBuffer | undefined>(undefined);

    // Wrap the user's handler in useEffectEvent so the effect never
    // re-subscribes when the handler identity changes between renders.
    const stableInputHandler = useEffectEvent(inputHandler);

    // Initialize IME buffer
    useEffect(() => {
        if (!imeEnabled) {
            return;
        }

        imeBufferRef.current = new IMECompositionBuffer({
            onFlush: (text: string) => {
                // Create a key object for IME input (no special keys pressed)
                const key: Key = {
                    backspace: false,
                    capsLock: false,
                    ctrl: false,
                    delete: false,
                    downArrow: false,
                    end: false,
                    escape: false,
                    home: false,
                    hyper: false,
                    leftArrow: false,
                    meta: false,
                    numLock: false,
                    pageDown: false,
                    pageUp: false,
                    return: false,
                    rightArrow: false,
                    shift: false,
                    super: false,
                    tab: false,
                    upArrow: false,
                };

                // @ts-expect-error Types require 5 arguments (fn, a, b, c, d) but only fn is needed at runtime.
                reconciler.discreteUpdates(() => {
                    stableInputHandler(text, key);
                });
            },
            timeout: imeTimeout,
        });

        return () => {
            imeBufferRef.current?.destroy();
            imeBufferRef.current = undefined;
        };
    }, [imeEnabled, imeTimeout]);

    useEffect(() => {
        if (options.isActive === false) {
            return;
        }

        setRawMode(true);

        return () => {
            setRawMode(false);
        };
    }, [options.isActive, setRawMode]);

    useEffect(() => {
        if (options.isActive === false) {
            return;
        }

        const handleData = (data: string) => {
            // Check if this is IME input
            if (imeEnabled && isIMEInput(data)) {
                imeBufferRef.current?.add(data);

                return;
            }

            // Flush any pending IME input before processing regular input
            imeBufferRef.current?.flush();

            const keypress = parseKeypress(data);

            const key: Key = {
                backspace: keypress.name === "backspace",
                capsLock: keypress.capsLock ?? false,
                ctrl: keypress.ctrl,
                delete: keypress.name === "delete",
                downArrow: keypress.name === "down",
                end: keypress.name === "end",
                escape: keypress.name === "escape",
                eventType: keypress.eventType,
                home: keypress.name === "home",
                hyper: keypress.hyper ?? false,
                leftArrow: keypress.name === "left",
                // `parseKeypress` parses \u001B\u001B[A (meta + up arrow) as meta = false
                // but with option = true, so we need to take this into account here.
                // Plain Escape no longer sets meta — only actual Alt/Meta modifier
                // combinations do.
                meta: keypress.meta || keypress.option,
                numLock: keypress.numLock ?? false,
                pageDown: keypress.name === "pagedown",
                pageUp: keypress.name === "pageup",
                return: keypress.name === "return",
                rightArrow: keypress.name === "right",
                shift: keypress.shift,
                // Kitty keyboard protocol modifiers
                super: keypress.super ?? false,
                tab: keypress.name === "tab",
                upArrow: keypress.name === "up",
            };

            let input: string;

            if (keypress.isKittyProtocol) {
                // Use text-as-codepoints field for printable keys (needed when
                // reportAllKeysAsEscapeCodes flag is enabled), suppress non-printable
                if (keypress.isPrintable) {
                    input = keypress.text ?? keypress.name;
                } else if (keypress.ctrl && keypress.name.length === 1) {
                    // Ctrl+letter via codepoint 1-26 form: not printable text, but
                    // the letter name must flow through so handlers (e.g. exitOnCtrlC
                    // checking `input === 'c' && key.ctrl`) still work.
                    input = keypress.name;
                } else {
                    input = "";
                }
            } else if (keypress.ctrl) {
                input = keypress.name;
            } else {
                input = keypress.sequence;
            }

            if (!keypress.isKittyProtocol && nonAlphanumericKeys.includes(keypress.name)) {
                input = "";
            }

            // Strip meta if it's still remaining after `parseKeypress`
            // TODO(vadimdemedes): remove this in the next major version.
            if (input.startsWith("\u001B")) {
                input = input.slice(1);
            }

            if (input.length === 1 && typeof input[0] === "string" && /[A-Z]/.test(input[0])) {
                key.shift = true;
            }

            // If app is supposed to exit on Ctrl+C, skip input listeners.
            if (input === "c" && key.ctrl && internal_exitOnCtrlC) {
                return;
            }

            // Skip unmapped key codes that have no name and produced no input
            // text — calling the handler with empty values would be confusing
            // and could cause crashes in user code that doesn't expect it.
            if (!keypress.name && input === "") {
                return;
            }

            // Use discreteUpdates to assign DiscreteEventPriority to state
            // updates from keyboard input, ensuring they are processed at the
            // highest priority in concurrent mode.
            // @ts-expect-error Types require 5 arguments (fn, a, b, c, d) but only fn is needed at runtime.
            reconciler.discreteUpdates(() => {
                stableInputHandler(input, key);
            });
        };

        internal_eventEmitter.on("input", handleData);

        return () => {
            internal_eventEmitter.removeListener("input", handleData);
        };
    }, [options.isActive, stdin, internal_exitOnCtrlC, imeEnabled]);
};

export default useInput;

export { useInput };
