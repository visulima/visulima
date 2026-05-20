/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain, consistent-return, default-case, e18e/prefer-static-regex, jsdoc/match-description, no-control-regex, sonarjs/slow-regex, unicorn/no-null */
import type { Context, RefObject } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { InputParser, MouseEvent, TuiApp } from "../core/index";
import type { LayoutNode } from "./layout";

export interface TuiContextProps {
    app: TuiApp;
    input: InputParser;
    writeStderr: (text: string) => void;
    writeStdout: (text: string) => void;
}

export const TuiContext: Context<TuiContextProps | null> = createContext<TuiContextProps | null>(null);

export interface Key {
    backspace: boolean;
    ctrl: boolean;
    delete: boolean;
    downArrow: boolean;
    end: boolean;
    escape: boolean;
    home: boolean;
    leftArrow: boolean;
    meta: boolean;
    pageDown: boolean;
    pageUp: boolean;
    return: boolean;
    rightArrow: boolean;
    shift: boolean;
    tab: boolean;
    upArrow: boolean;
}

export type InputHandler = (input: string, key: Key) => void;

/**
 * Subscribes to keyboard input. Uses a stable ref so the effect runs
 * exactly once (on mount) regardless of how often the component re-renders.
 * Always invokes the latest handler passed by the caller.
 */
export const useInput = (handler: InputHandler): void => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("useInput must be used within a TUI App environment");
    }

    // 1. Stable ref initialized with the first handler value
    const handlerRef = useRef<InputHandler>(handler);

    // 2. Sync ref on every render (no dep array) — always up to date
    useEffect(() => {
        handlerRef.current = handler;
    });

    // 3. Stable effect: subscribe once per context instance, use ref inside
    useEffect(() => {
        const key = (overrides: Partial<Key>): Key => {
            return {
                backspace: false,
                ctrl: false,
                delete: false,
                downArrow: false,
                end: false,
                escape: false,
                home: false,
                leftArrow: false,
                meta: false,
                pageDown: false,
                pageUp: false,
                return: false,
                rightArrow: false,
                shift: false,
                tab: false,
                upArrow: false,
                ...overrides,
            };
        };

        const handleKeydown = (keyName: string) => {
            switch (keyName) {
                case "backspace": {
                    return handlerRef.current("", key({ backspace: true }));
                }
                case "delete": {
                    return handlerRef.current("", key({ delete: true }));
                }
                case "down": {
                    return handlerRef.current("", key({ downArrow: true }));
                }
                case "end": {
                    return handlerRef.current("", key({ end: true }));
                }
                case "enter": {
                    return handlerRef.current("", key({ return: true }));
                }
                case "escape": {
                    return handlerRef.current("", key({ escape: true }));
                }
                case "home": {
                    return handlerRef.current("", key({ home: true }));
                }
                case "left": {
                    return handlerRef.current("", key({ leftArrow: true }));
                }
                case "pageDown": {
                    return handlerRef.current("", key({ pageDown: true }));
                }
                case "pageUp": {
                    return handlerRef.current("", key({ pageUp: true }));
                }
                case "right": {
                    return handlerRef.current("", key({ rightArrow: true }));
                }
                case "shift-tab": {
                    return handlerRef.current("", key({ shift: true, tab: true }));
                }
                case "tab": {
                    return handlerRef.current("", key({ tab: true }));
                }
                case "up": {
                    return handlerRef.current("", key({ upArrow: true }));
                }
            }
        };

        const handleCtrl = (letter: string) => {
            handlerRef.current(letter, key({ ctrl: true }));
        };

        const handleMeta = (letter: string) => {
            handlerRef.current(letter, key({ meta: true }));
        };

        const handleData = (data: string, flags?: { ctrl?: boolean; meta?: boolean }) => {
            if (data.startsWith("\u001B")) {
                return;
            } // unhandled escape sequences

            if (data === "\r" || data === "\n") {
                return;
            }

            handlerRef.current(
                data,
                key({
                    ctrl: flags?.ctrl ?? false,
                    meta: flags?.meta ?? false,
                }),
            );
        };

        context.input.on("keydown", handleKeydown);
        context.input.on("ctrl", handleCtrl);
        context.input.on("meta", handleMeta);
        context.input.on("data", handleData);

        return () => {
            context.input.off("keydown", handleKeydown);
            context.input.off("ctrl", handleCtrl);
            context.input.off("meta", handleMeta);
            context.input.off("data", handleData);
        };
    }, [context]);
};

// ─── usePaste ─────────────────────────────────────────────────────────────────

export interface UsePasteOptions {
    /**
     * Enable or disable capturing pasted text.
     * Useful when multiple components use usePaste and only one should be active.
     * @default true
     */
    isActive?: boolean;
}

export type PasteHandler = (text: string) => void;

/**
 * Subscribe to bracketed paste events.
 *
 * `usePaste` and `useInput` can be used together. Paste content is delivered
 * through this hook and not forwarded to useInput while at least one paste
 * listener is active.
 */
export const usePaste = (handler: PasteHandler, options: UsePasteOptions = {}): void => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("usePaste must be used within a TUI App environment");
    }

    const { isActive = true } = options;

    const handlerRef = useRef<PasteHandler>(handler);

    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!isActive) {
            return;
        }

        const onPaste = (text: string) => {
            handlerRef.current(text);
        };

        context.input.on("paste", onPaste);

        return () => {
            context.input.off("paste", onPaste);
        };
    }, [context, isActive]);
};

/**
 * Raw access to the TuiContext — app instance + input parser.
 * Useful for advanced integrations (e.g. DevTools, custom hooks).
 */
export const useTuiContext = (): TuiContextProps => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("useTuiContext must be used within a TUI App environment");
    }

    return context;
};

/**
 * Access app controls. Returns { exit } for Ink compatibility.
 * exit() triggers a clean shutdown (restores terminal, stops input, exits process).
 */
export const useApp = (): { exit: () => void; quit: () => void } => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("useApp must be used within a TUI App environment");
    }

    return {
        // Ink-compatible: const { exit } = useApp()
        exit: () => context.app.quit(),
        // internal: direct app access
        quit: () => context.app.quit(),
    };
};

/**
 * Returns current terminal dimensions and re-renders on resize (SIGWINCH).
 * Ink-compatible: const { columns, rows } = useWindowSize()
 */
export const useWindowSize = (): { columns: number; rows: number } => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("useWindowSize must be used within a TUI App environment");
    }

    const [size, setSize] = useState(() => context.app.getSize());

    useEffect(() => {
        const onResize = () => setSize(context.app.getSize());

        context.app.on("resize", onResize);

        return () => {
            context.app.off("resize", onResize);
        };
    }, [context]);

    return { columns: size.width, rows: size.height };
};

/**
 * In raw mode, \n moves the cursor down but does not return to column 0.
 * Must use \r\n to get a proper newline. Apply this to any text written
 * outside the TUI render path (useStdout/useStderr write calls).
 */
const toRawNewlines = (text: string) => text.replaceAll(/\r?\n/g, "\r\n");

/**
 * Write to stdout without disturbing the TUI.
 * Ink-compatible: const { write, stdout } = useStdout()
 * Output is buffered while the alternate screen is active and flushed on exit.
 */
export const useStdout = (): { stdout: NodeJS.WriteStream & { fd: 1 }; write: (text: string) => void } => {
    const context = useContext(TuiContext);

    return {
        stdout: process.stdout,
        write: (text: string): void => {
            context ? context.writeStdout(text) : process.stdout.write(toRawNewlines(text));
        },
    };
};

/**
 * Write to stderr without disturbing the TUI.
 * Ink-compatible: const { write, stderr } = useStderr()
 * Output is buffered while the alternate screen is active and flushed on exit.
 */
export const useStderr = (): { stderr: NodeJS.WriteStream & { fd: 2 }; write: (text: string) => void } => {
    const context = useContext(TuiContext);

    return {
        stderr: process.stderr,
        write: (text: string): void => {
            context ? context.writeStderr(text) : process.stderr.write(toRawNewlines(text));
        },
    };
};

/**
 * Access raw stdin stream and raw mode controls.
 * Ink-compatible: const { stdin, setRawMode, isRawModeSupported } = useStdin()
 */
export const useStdin = (): { isRawModeSupported: boolean; setRawMode: (value: boolean) => void; stdin: NodeJS.ReadStream & { fd: 0 } } => {
    const isRawModeSupported: boolean = !!process.stdin.setRawMode;

    return {
        isRawModeSupported,
        setRawMode: (value: boolean): void => {
            if (isRawModeSupported) {
                process.stdin.setRawMode(value);
            }
        },
        stdin: process.stdin,
    };
};

/**
 * Measure the dimensions of a Box element.
 * Returns { width, height } after layout has been calculated.
 * Returns { width: 0, height: 0 } when called during render (before layout).
 * Ink-compatible: measureElement(ref.current)
 */
export const measureElement = (node: LayoutNode | null): { height: number; width: number } => {
    if (!node || !node.yogaNode) {
        return { height: 0, width: 0 };
    }

    return {
        height: node.yogaNode.getComputedHeight() ?? 0,
        width: node.yogaNode.getComputedWidth() ?? 0,
    };
};

export interface BoxMetrics {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
}

export interface UseBoxMetricsResult extends BoxMetrics {
    readonly hasMeasured: boolean;
}

const emptyMetrics: BoxMetrics = { height: 0, left: 0, top: 0, width: 0 };

/**
 * Returns the current layout metrics for a Box ref, updating on every render
 * and on terminal resize.
 * Ink-compatible: const { width, height, left, top, hasMeasured } = useBoxMetrics(ref)
 */
export const useBoxMetrics = (ref: RefObject<LayoutNode | null>): UseBoxMetricsResult => {
    const context = useContext(TuiContext);
    const [metrics, setMetrics] = useState<BoxMetrics>(emptyMetrics);
    const [hasMeasured, setHasMeasured] = useState(false);

    const updateMetrics = useCallback(() => {
        if (!ref.current?.yogaNode) {
            setHasMeasured(false);

            return;
        }

        const layout = ref.current.getLayout();

        setMetrics((previous) => {
            if (previous.width === layout.width && previous.height === layout.height && previous.left === layout.left && previous.top === layout.top) {
                return previous;
            }

            return { height: layout.height, left: layout.left, top: layout.top, width: layout.width };
        });
        setHasMeasured(true);
    }, [ref]);

    // Update after every render (catches local state/prop changes)
    useEffect(updateMetrics);

    // Update on terminal resize
    useEffect(() => {
        if (!context?.app) {
            return;
        }

        context.app.on("resize", updateMetrics);

        return () => {
            context.app.off("resize", updateMetrics);
        };
    }, [context, updateMetrics]);

    return useMemo(() => {
        return { ...metrics, hasMeasured };
    }, [metrics, hasMeasured]);
};

/**
 * Returns whether a screen reader is enabled.
 * Stub: always returns false — no screen reader support.
 * Ink-compatible: const isEnabled = useIsScreenReaderEnabled()
 */
export const useIsScreenReaderEnabled = (): boolean => false;

/**
 * Returns cursor positioning controls.
 * Stub: the native renderer hides the cursor during rendering (alternate screen).
 * setCursorPosition is a no-op — provided for Ink API compatibility only.
 * Ink-compatible: const { setCursorPosition } = useCursor()
 */
export const useCursor = (): { setCursorPosition: (position: { x: number; y: number } | undefined) => void } => {
    return {
        setCursorPosition: (_position: { x: number; y: number } | undefined): void => {},
    };
};

/**
 * Scroll state for a fixed-height viewport over variable-height content.
 *
 * Usage:
 *   const scroll = useScrollable({ viewportHeight: 20, contentHeight: totalRows })
 *
 *   &lt;Box height={20}>
 *     &lt;Box marginTop={-scroll.offset}>
 *       {items}
 *     &lt;/Box>
 *   &lt;/Box>
 *
 * contentHeight can be updated as content grows. The offset is automatically
 * clamped so it never scrolls past the end.
 *
 * scrollToBottom() is idempotent — safe to call on every new message append.
 */
export interface UseScrollableOptions {
    /** Total height of the content in rows — update as content grows */
    contentHeight: number;
    /** Height of the visible window in rows */
    viewportHeight: number;
}

export interface UseScrollableResult {
    /** True when already at the bottom */
    atBottom: boolean;
    /** True when already at the top */
    atTop: boolean;
    /** Current scroll offset in rows (0 = top) */
    offset: number;
    /** Scroll down N rows */
    scrollBy: (n: number) => void;
    /** Scroll down one row */
    scrollDown: () => void;
    /** Jump to the very bottom */
    scrollToBottom: () => void;
    /** Jump to the very top */
    scrollToTop: () => void;
    /** Scroll up one row */
    scrollUp: () => void;
}

export const useScrollable = ({ contentHeight, viewportHeight }: UseScrollableOptions): UseScrollableResult => {
    const [offset, setOffset] = useState(0);

    // max offset: content taller than viewport → can scroll, else 0
    const max = Math.max(0, contentHeight - viewportHeight);

    // clamp helper — always stays in [0, max]
    const clamp = useCallback((n: number) => Math.max(0, Math.min(n, max)), [max]);

    // When content grows (new messages), keep offset clamped to new max
    useEffect(() => {
        setOffset((o) => clamp(o));
    }, [max, clamp]);

    return useMemo(() => {
        return {
            atBottom: clamp(offset) >= max,
            atTop: clamp(offset) <= 0,
            offset: clamp(offset),
            scrollBy: (n: number) => setOffset((o) => clamp(o + n)),
            scrollDown: () => setOffset((o) => clamp(o + 1)),
            scrollToBottom: () => setOffset(max),
            scrollToTop: () => setOffset(0),
            scrollUp: () => setOffset((o) => clamp(o - 1)),
        };
    }, [offset, max, clamp]);
};

// ─── useMouse ─────────────────────────────────────────────────────────────────

export type MouseHandler = (event: MouseEvent) => void;

/**
 * Subscribe to mouse events. Requires mouse tracking to be enabled (it is by
 * default — TerminalGuard enables SGR 1006 mouse tracking on start).
 *
 * Usage:
 *   useMouse((event) => {
 *     if (event.button === 'left') { ... }
 *     if (event.button === 'scrollUp') { ... }
 *     // event: { x, y, button, shift, ctrl, meta }
 *   })
 *
 * button values: 'left' | 'right' | 'middle' | 'scrollUp' | 'scrollDown'
 */
export const useMouse = (handler: MouseHandler): void => {
    const context = useContext(TuiContext);

    if (!context) {
        throw new Error("useMouse must be used within a TUI App environment");
    }

    const handlerRef = useRef<MouseHandler>(handler);

    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        const onMouse = (event: MouseEvent) => handlerRef.current(event);

        context.input.on("mouse", onMouse);

        return () => {
            context.input.off("mouse", onMouse);
        };
    }, [context]);
};

// ─── useTextInput ─────────────────────────────────────────────────────────────

export interface UseTextInputOptions {
    /** Initial value (default: '') */
    initialValue?: string;
    /** When false, the hook ignores all input (default: true) */
    isActive?: boolean;
    /** Called on every keystroke with the new value */
    onChange?: (value: string) => void;
    /** Called when the user presses Enter */
    onSubmit?: (value: string) => void;
}

export interface UseTextInputResult {
    /** Clear the input */
    clear: () => void;
    /** Cursor position (0 = before first char, value.length = after last char) */
    cursor: number;
    /** Set value programmatically */
    setValue: (value: string) => void;
    /** Current text value */
    value: string;
}

/**
 * Managed text input with cursor, backspace, delete, left/right navigation,
 * home/end, bracketed paste, and submit on Enter.
 *
 * Usage:
 *   const { value, cursor } = useTextInput({ onSubmit: (v) => console.log(v) })
 *   &lt;Text>{value.slice(0, cursor)}&lt;Text inverse> &lt;/Text>{value.slice(cursor)}&lt;/Text>
 *
 * Renders a block cursor by inverting the character at cursor position.
 * When cursor is at end, renders a trailing space as the cursor block.
 */
export const useTextInput = ({ initialValue = "", isActive = true, onChange, onSubmit }: UseTextInputOptions = {}): UseTextInputResult => {
    const [value, setValueRaw] = useState(initialValue);
    const [cursor, setCursor] = useState(initialValue.length);

    // Refs that are always current — safe to read inside useInput's stable closure
    const valueRef = useRef(value);
    const cursorRef = useRef(cursor);

    useEffect(() => {
        valueRef.current = value;
    });
    useEffect(() => {
        cursorRef.current = cursor;
    });

    // Keep callbacks stable
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    });
    const onSubmitRef = useRef(onSubmit);

    useEffect(() => {
        onSubmitRef.current = onSubmit;
    });

    const setValue = useCallback((newValue: string) => {
        setValueRaw(newValue);
        setCursor(newValue.length);
    }, []);

    const clear = useCallback(() => {
        setValueRaw("");
        setCursor(0);
        onChangeRef.current?.("");
    }, []);

    useInput((input, key) => {
        if (!isActive) {
            return;
        }

        const { current } = cursorRef;
        const value_ = valueRef.current;

        if (key.return) {
            onSubmitRef.current?.(value_);

            return;
        }

        if (key.escape) {
            return;
        }

        if (key.leftArrow) {
            setCursor(Math.max(0, current - 1));

            return;
        }

        if (key.rightArrow) {
            setCursor(Math.min(value_.length, current + 1));

            return;
        }

        if (key.home || (key.ctrl && input === "a")) {
            setCursor(0);

            return;
        }

        if (key.end || (key.ctrl && input === "e")) {
            setCursor(value_.length);

            return;
        }

        if (key.backspace) {
            if (current === 0) {
                return;
            }

            const next = value_.slice(0, current - 1) + value_.slice(current);

            setValueRaw(next);
            setCursor(current - 1);
            onChangeRef.current?.(next);

            return;
        }

        if (key.delete) {
            if (current >= value_.length) {
                return;
            }

            const next = value_.slice(0, current) + value_.slice(current + 1);

            setValueRaw(next);
            onChangeRef.current?.(next);

            return;
        }

        // Ctrl+U — kill to start of line
        if (key.ctrl && input === "u") {
            const next = value_.slice(current);

            setValueRaw(next);
            setCursor(0);
            onChangeRef.current?.(next);

            return;
        }

        // Ctrl+K — kill to end of line
        if (key.ctrl && input === "k") {
            const next = value_.slice(0, current);

            setValueRaw(next);
            onChangeRef.current?.(next);

            return;
        }

        // Ctrl+W — kill word before cursor
        if (key.ctrl && input === "w") {
            const before = value_.slice(0, current);
            const trimmed = before.replace(/\S+\s*$/, "");
            const next = trimmed + value_.slice(current);

            setValueRaw(next);
            setCursor(trimmed.length);
            onChangeRef.current?.(next);

            return;
        }

        // Ignore other ctrl/meta combos
        if (key.ctrl || key.meta) {
            return;
        }

        // Printable character — insert at cursor
        if (input && input.length > 0) {
            const next = value_.slice(0, current) + input + value_.slice(current);

            setValueRaw(next);
            setCursor(current + input.length);
            onChangeRef.current?.(next);
        }
    });

    // Bracketed paste — insert full paste text at cursor
    const context = useContext(TuiContext);

    useEffect(() => {
        if (!context || !isActive) {
            return;
        }

        const onPaste = (text: string) => {
            // Strip control characters; convert CR/CRLF → space
            const safe = text.replaceAll(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replaceAll(/\r\n?/g, " ");
            const { current } = cursorRef;
            const value_ = valueRef.current;
            const next = value_.slice(0, current) + safe + value_.slice(current);

            setValueRaw(next);
            setCursor(current + safe.length);
            onChangeRef.current?.(next);
        };

        context.input.on("paste", onPaste);

        return () => {
            context.input.off("paste", onPaste);
        };
    }, [context, isActive]);

    return { clear, cursor, setValue, value };
};
