import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type Context, type RefObject } from "react";
import { RatatatApp, InputParser, type MouseEvent } from "../core/index.js";
import { LayoutNode } from "./layout.js";

export interface RatatatContextProps {
    app: RatatatApp;
    input: InputParser;
    writeStdout: (text: string) => void;
    writeStderr: (text: string) => void;
}

export const RatatatContext: Context<RatatatContextProps | null> = createContext<RatatatContextProps | null>(null);

export interface Key {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    return: boolean;
    backspace: boolean;
    delete: boolean;
    pageUp: boolean;
    pageDown: boolean;
    home: boolean;
    end: boolean;
    tab: boolean;
    shift: boolean;
    escape: boolean;
    ctrl: boolean;
    meta: boolean;
}

export type InputHandler = (input: string, key: Key) => void;

/**
 * Subscribes to keyboard input. Uses a stable ref so the effect runs
 * exactly once (on mount) regardless of how often the component re-renders.
 * Always invokes the latest handler passed by the caller.
 */
export const useInput = (handler: InputHandler): void => {
    const context = useContext(RatatatContext);

    if (!context) {
        throw new Error("useInput must be used within a Ratatat App environment");
    }

    // 1. Stable ref initialized with the first handler value
    const handlerRef = useRef<InputHandler>(handler);

    // 2. Sync ref on every render (no dep array) — always up to date
    useEffect(() => {
        handlerRef.current = handler;
    });

    // 3. Stable effect: subscribe once per context instance, use ref inside
    useEffect(() => {
        const key = (overrides: Partial<Key>): Key => ({
            upArrow: false,
            downArrow: false,
            leftArrow: false,
            rightArrow: false,
            return: false,
            backspace: false,
            delete: false,
            pageUp: false,
            pageDown: false,
            home: false,
            end: false,
            tab: false,
            shift: false,
            escape: false,
            ctrl: false,
            meta: false,
            ...overrides,
        });

        const handleKeydown = (keyName: string) => {
            switch (keyName) {
                case "up":
                    return handlerRef.current("", key({ upArrow: true }));
                case "down":
                    return handlerRef.current("", key({ downArrow: true }));
                case "left":
                    return handlerRef.current("", key({ leftArrow: true }));
                case "right":
                    return handlerRef.current("", key({ rightArrow: true }));
                case "enter":
                    return handlerRef.current("", key({ return: true }));
                case "backspace":
                    return handlerRef.current("", key({ backspace: true }));
                case "delete":
                    return handlerRef.current("", key({ delete: true }));
                case "pageUp":
                    return handlerRef.current("", key({ pageUp: true }));
                case "pageDown":
                    return handlerRef.current("", key({ pageDown: true }));
                case "home":
                    return handlerRef.current("", key({ home: true }));
                case "end":
                    return handlerRef.current("", key({ end: true }));
                case "tab":
                    return handlerRef.current("", key({ tab: true }));
                case "shift-tab":
                    return handlerRef.current("", key({ tab: true, shift: true }));
                case "escape":
                    return handlerRef.current("", key({ escape: true }));
            }
        };

        const handleCtrl = (letter: string) => {
            handlerRef.current(letter, key({ ctrl: true }));
        };

        const handleMeta = (letter: string) => {
            handlerRef.current(letter, key({ meta: true }));
        };

        const handleData = (data: string, flags?: { ctrl?: boolean; meta?: boolean }) => {
            if (data.startsWith("\u001b")) return; // unhandled escape sequences
            if (data === "\r" || data === "\n") return;
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
     *
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
    const context = useContext(RatatatContext);
    if (!context) {
        throw new Error("usePaste must be used within a Ratatat App environment");
    }

    const { isActive = true } = options;

    const handlerRef = useRef<PasteHandler>(handler);
    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!isActive) return;

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
 * Raw access to the RatatatContext — app instance + input parser.
 * Useful for advanced integrations (e.g. DevTools, custom hooks).
 */
export const useRatatatContext = (): RatatatContextProps => {
    const context = useContext(RatatatContext);
    if (!context) throw new Error("useRatatatContext must be used within a Ratatat App environment");
    return context;
};

/**
 * Access app controls. Returns { exit } for Ink compatibility.
 * exit() triggers a clean shutdown (restores terminal, stops input, exits process).
 */
export const useApp = (): { exit: () => void; quit: () => void } => {
    const context = useContext(RatatatContext);

    if (!context) {
        throw new Error("useApp must be used within a Ratatat App environment");
    }

    return {
        // Ink-compatible: const { exit } = useApp()
        exit: () => context.app.quit(),
        // ratatat-native: direct app access
        quit: () => context.app.quit(),
    };
};

/**
 * Returns current terminal dimensions and re-renders on resize (SIGWINCH).
 * Ink-compatible: const { columns, rows } = useWindowSize()
 */
export const useWindowSize = (): { columns: number; rows: number } => {
    const context = useContext(RatatatContext);

    if (!context) {
        throw new Error("useWindowSize must be used within a Ratatat App environment");
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
const toRawNewlines = (text: string) => text.replace(/\r?\n/g, "\r\n");

/**
 * Write to stdout without disturbing the TUI.
 * Ink-compatible: const { write, stdout } = useStdout()
 * Output is buffered while the alternate screen is active and flushed on exit.
 */
export const useStdout = (): { stdout: NodeJS.WriteStream & { fd: 1 }; write: (text: string) => void } => {
    const context = useContext(RatatatContext);
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
    const context = useContext(RatatatContext);
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
export const useStdin = (): { stdin: NodeJS.ReadStream & { fd: 0 }; isRawModeSupported: boolean; setRawMode: (value: boolean) => void } => {
    const isRawModeSupported: boolean = !!process.stdin.setRawMode;
    return {
        stdin: process.stdin,
        isRawModeSupported: isRawModeSupported,
        setRawMode: (value: boolean): void => {
            if (isRawModeSupported) {
                process.stdin.setRawMode(value);
            }
        },
    };
};

/**
 * Measure the dimensions of a Box element.
 * Returns { width, height } after layout has been calculated.
 * Returns { width: 0, height: 0 } when called during render (before layout).
 * Ink-compatible: measureElement(ref.current)
 */
export const measureElement = (node: LayoutNode | null): { width: number; height: number } => {
    if (!node || !node.yogaNode) return { width: 0, height: 0 };
    return {
        width: node.yogaNode.getComputedWidth() ?? 0,
        height: node.yogaNode.getComputedHeight() ?? 0,
    };
};

export interface BoxMetrics {
    readonly width: number;
    readonly height: number;
    readonly left: number;
    readonly top: number;
}

export interface UseBoxMetricsResult extends BoxMetrics {
    readonly hasMeasured: boolean;
}

const emptyMetrics: BoxMetrics = { width: 0, height: 0, left: 0, top: 0 };

/**
 * Returns the current layout metrics for a Box ref, updating on every render
 * and on terminal resize.
 * Ink-compatible: const { width, height, left, top, hasMeasured } = useBoxMetrics(ref)
 */
export const useBoxMetrics = (ref: RefObject<LayoutNode | null>): UseBoxMetricsResult => {
    const context = useContext(RatatatContext);
    const [metrics, setMetrics] = useState<BoxMetrics>(emptyMetrics);
    const [hasMeasured, setHasMeasured] = useState(false);

    const updateMetrics = useCallback(() => {
        if (!ref.current?.yogaNode) {
            setHasMeasured(false);
            return;
        }
        const layout = ref.current.getLayout();
        setMetrics((prev) => {
            if (prev.width === layout.width && prev.height === layout.height && prev.left === layout.left && prev.top === layout.top) return prev;
            return { width: layout.width, height: layout.height, left: layout.left, top: layout.top };
        });
        setHasMeasured(true);
    }, [ref]);

    // Update after every render (catches local state/prop changes)
    useEffect(updateMetrics);

    // Update on terminal resize
    useEffect(() => {
        if (!context?.app) return;
        context.app.on("resize", updateMetrics);
        return () => {
            context.app.off("resize", updateMetrics);
        };
    }, [context, updateMetrics]);

    return useMemo(() => ({ ...metrics, hasMeasured }), [metrics, hasMeasured]);
};

/**
 * Returns whether a screen reader is enabled.
 * Ratatat stub: always returns false — no screen reader support.
 * Ink-compatible: const isEnabled = useIsScreenReaderEnabled()
 */
export const useIsScreenReaderEnabled = (): boolean => false;

/**
 * Returns cursor positioning controls.
 * Ratatat stub: ratatat hides the cursor during rendering (alternate screen).
 * setCursorPosition is a no-op — provided for Ink API compatibility only.
 * Ink-compatible: const { setCursorPosition } = useCursor()
 */
export const useCursor = (): { setCursorPosition: (position: { x: number; y: number } | undefined) => void } => ({
    setCursorPosition: (_position: { x: number; y: number } | undefined): void => {},
});

/**
 * Scroll state for a fixed-height viewport over variable-height content.
 *
 * Usage:
 *   const scroll = useScrollable({ viewportHeight: 20, contentHeight: totalRows })
 *
 *   <Box height={20}>
 *     <Box marginTop={-scroll.offset}>
 *       {items}
 *     </Box>
 *   </Box>
 *
 * contentHeight can be updated as content grows. The offset is automatically
 * clamped so it never scrolls past the end.
 *
 * scrollToBottom() is idempotent — safe to call on every new message append.
 */
export interface UseScrollableOptions {
    /** Height of the visible window in rows */
    viewportHeight: number;
    /** Total height of the content in rows — update as content grows */
    contentHeight: number;
}

export interface UseScrollableResult {
    /** Current scroll offset in rows (0 = top) */
    offset: number;
    /** Scroll down one row */
    scrollDown: () => void;
    /** Scroll up one row */
    scrollUp: () => void;
    /** Scroll down N rows */
    scrollBy: (n: number) => void;
    /** Jump to the very bottom */
    scrollToBottom: () => void;
    /** Jump to the very top */
    scrollToTop: () => void;
    /** True when already at the bottom */
    atBottom: boolean;
    /** True when already at the top */
    atTop: boolean;
}

export const useScrollable = ({ viewportHeight, contentHeight }: UseScrollableOptions): UseScrollableResult => {
    const [offset, setOffset] = useState(0);

    // max offset: content taller than viewport → can scroll, else 0
    const max = Math.max(0, contentHeight - viewportHeight);

    // clamp helper — always stays in [0, max]
    const clamp = useCallback((n: number) => Math.max(0, Math.min(n, max)), [max]);

    // When content grows (new messages), keep offset clamped to new max
    useEffect(() => {
        setOffset((o) => clamp(o));
    }, [max, clamp]);

    return useMemo(
        () => ({
            offset: clamp(offset),
            scrollDown: () => setOffset((o) => clamp(o + 1)),
            scrollUp: () => setOffset((o) => clamp(o - 1)),
            scrollBy: (n: number) => setOffset((o) => clamp(o + n)),
            scrollToBottom: () => setOffset(max),
            scrollToTop: () => setOffset(0),
            atBottom: clamp(offset) >= max,
            atTop: clamp(offset) <= 0,
        }),
        [offset, max, clamp],
    );
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
    const context = useContext(RatatatContext);
    if (!context) throw new Error("useMouse must be used within a Ratatat App environment");

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
    /** Called when the user presses Enter */
    onSubmit?: (value: string) => void;
    /** Called on every keystroke with the new value */
    onChange?: (value: string) => void;
    /** When false, the hook ignores all input (default: true) */
    isActive?: boolean;
}

export interface UseTextInputResult {
    /** Current text value */
    value: string;
    /** Cursor position (0 = before first char, value.length = after last char) */
    cursor: number;
    /** Set value programmatically */
    setValue: (value: string) => void;
    /** Clear the input */
    clear: () => void;
}

/**
 * Managed text input with cursor, backspace, delete, left/right navigation,
 * home/end, bracketed paste, and submit on Enter.
 *
 * Usage:
 *   const { value, cursor } = useTextInput({ onSubmit: (v) => console.log(v) })
 *   <Text>{value.slice(0, cursor)}<Text inverse> </Text>{value.slice(cursor)}</Text>
 *
 * Renders a block cursor by inverting the character at cursor position.
 * When cursor is at end, renders a trailing space as the cursor block.
 */
export const useTextInput = ({ initialValue = "", onSubmit, onChange, isActive = true }: UseTextInputOptions = {}): UseTextInputResult => {
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
        if (!isActive) return;

        const cur = cursorRef.current;
        const val = valueRef.current;

        if (key.return) {
            onSubmitRef.current?.(val);
            return;
        }

        if (key.escape) return;

        if (key.leftArrow) {
            setCursor(Math.max(0, cur - 1));
            return;
        }

        if (key.rightArrow) {
            setCursor(Math.min(val.length, cur + 1));
            return;
        }

        if (key.home || (key.ctrl && input === "a")) {
            setCursor(0);
            return;
        }

        if (key.end || (key.ctrl && input === "e")) {
            setCursor(val.length);
            return;
        }

        if (key.backspace) {
            if (cur === 0) return;
            const next = val.slice(0, cur - 1) + val.slice(cur);
            setValueRaw(next);
            setCursor(cur - 1);
            onChangeRef.current?.(next);
            return;
        }

        if (key.delete) {
            if (cur >= val.length) return;
            const next = val.slice(0, cur) + val.slice(cur + 1);
            setValueRaw(next);
            onChangeRef.current?.(next);
            return;
        }

        // Ctrl+U — kill to start of line
        if (key.ctrl && input === "u") {
            const next = val.slice(cur);
            setValueRaw(next);
            setCursor(0);
            onChangeRef.current?.(next);
            return;
        }

        // Ctrl+K — kill to end of line
        if (key.ctrl && input === "k") {
            const next = val.slice(0, cur);
            setValueRaw(next);
            onChangeRef.current?.(next);
            return;
        }

        // Ctrl+W — kill word before cursor
        if (key.ctrl && input === "w") {
            const before = val.slice(0, cur);
            const trimmed = before.replace(/\S+\s*$/, "");
            const next = trimmed + val.slice(cur);
            setValueRaw(next);
            setCursor(trimmed.length);
            onChangeRef.current?.(next);
            return;
        }

        // Ignore other ctrl/meta combos
        if (key.ctrl || key.meta) return;

        // Printable character — insert at cursor
        if (input && input.length > 0) {
            const next = val.slice(0, cur) + input + val.slice(cur);
            setValueRaw(next);
            setCursor(cur + input.length);
            onChangeRef.current?.(next);
        }
    });

    // Bracketed paste — insert full paste text at cursor
    const context = useContext(RatatatContext);
    useEffect(() => {
        if (!context || !isActive) return;
        const onPaste = (text: string) => {
            // Strip control characters; convert CR/CRLF → space
            const safe = text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").replace(/\r\n?/g, " ");
            const cur = cursorRef.current;
            const val = valueRef.current;
            const next = val.slice(0, cur) + safe + val.slice(cur);
            setValueRaw(next);
            setCursor(cur + safe.length);
            onChangeRef.current?.(next);
        };
        context.input.on("paste", onPaste);
        return () => {
            context.input.off("paste", onPaste);
        };
    }, [context, isActive]);

    return { value, cursor, setValue, clear };
};
