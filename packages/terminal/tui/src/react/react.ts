/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-explicit-any, @typescript-eslint/no-shadow, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-use-before-define, @typescript-eslint/restrict-template-expressions, consistent-return, func-style, import/exports-last, jsdoc/match-description, no-console, promise/param-names, sonarjs/no-dead-store, unicorn/no-null, unicorn/no-process-exit, unused-imports/no-unused-vars */
// @ts-nocheck — reconciler createContainer arity varies between React versions
import React from "react";

import type { InlineOptions } from "../core/index";
import { createInlineLoop, InputParser, RatatatApp, terminalSize } from "../core/index";
import { FocusProvider, useFocusManager } from "./focus";
import { RatatatContext, useInput } from "./hooks";
import { LayoutNode } from "./layout";
import { RatatatReconciler, setOnAfterCommit } from "./reconciler";
import { renderTreeToBuffer } from "./renderer";
import type { Styles } from "./styles";

export interface BoxProps extends Styles {
    bg?: number;
    children?: React.ReactNode;
    fg?: number;
    styles?: number;
}

export interface TextProps extends Styles {
    bg?: number;
    children?: React.ReactNode;
    /** Ink compat alias for `dim` */
    dimColor?: boolean;
    fg?: number;
    styles?: number;
}

export const Box: React.FC<BoxProps> = (props) => React.createElement("box", props, props.children);

export const Text: React.FC<TextProps> = (props) =>
    // Wrap simple strings inside a text layout node
    React.createElement("text", props, props.children)
;

// ─── Spinner ──────────────────────────────────────────────────────────────────

const DEFAULT_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerProps extends Omit<TextProps, "children"> {
    /**
     * Animation frames. Defaults to Braille spinner frames.
     */
    frames?: ReadonlyArray<string>;

    /**
     * Interval between frame updates in milliseconds.
     * Default: 80ms
     */
    interval?: number;
}

/**
 * Animated single-character spinner.
 * @example
 * ```tsx
 * <Spinner color="cyan" />
 * <Spinner frames={['-', '\\', '|', '/']} interval={100} color="yellow" />
 * ```
 */
export const Spinner: React.FC<SpinnerProps> = ({ frames = DEFAULT_SPINNER_FRAMES, interval = 80, ...textProps }) => {
    const resolvedFrames = frames.length > 0 ? frames : ["-"];
    const [index, setIndex] = React.useState(0);

    React.useEffect(() => {
        if (interval <= 0 || resolvedFrames.length <= 1)
            return;

        const timer = setInterval(() => {
            setIndex((previous) => (previous + 1) % resolvedFrames.length);
        }, interval);

        return () => clearInterval(timer);
    }, [interval, resolvedFrames]);

    return React.createElement(Text, textProps, resolvedFrames[index] ?? "-");
};

// ─── ProgressBar ──────────────────────────────────────────────────────────────

export interface ProgressBarProps extends Omit<TextProps, "children"> {
    /** Wrap bar body with surrounding brackets. Default: true */
    bracket?: boolean;
    /** Character used for the completed segment. Default: █ */
    completeChar?: string;
    /** Character used for the remaining segment. Default: ░ */
    incompleteChar?: string;
    /** Maximum value. Default: 100 */
    max?: number;
    /** Render percentage text after the bar. Default: true */
    showPercentage?: boolean;
    /** Current value. */
    value: number;
    /** Number of cells used for the bar body. Default: 20 */
    width?: number;
}

/**
 * Terminal progress bar with optional percentage suffix.
 * @example
 * ```tsx
 * <ProgressBar value={42} color="green" />
 * <ProgressBar value={downloaded} max={total} width={30} showPercentage={false} />
 * ```
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
    bracket = true,
    completeChar = "█",
    incompleteChar = "░",
    max = 100,
    showPercentage = true,
    value,
    width = 20,
    ...textProps
}) => {
    const safeMax = max > 0 ? max : 1;
    const safeWidth = Math.max(1, Math.floor(width));
    const clamped = Math.max(0, Math.min(value, safeMax));
    const ratio = clamped / safeMax;

    const filled = Math.round(ratio * safeWidth);
    const body = completeChar.repeat(filled) + incompleteChar.repeat(Math.max(0, safeWidth - filled));
    const percent = Math.round(ratio * 100);

    const bar = bracket ? `[${body}]` : body;
    const output = showPercentage ? `${bar} ${percent}%` : bar;

    return React.createElement(Text, textProps, output);
};

/**
 * Renders a newline character — equivalent to a line break in the layout.
 * Ink-compatible: &lt;Newline count={2} />
 */
export interface NewlineProps {
    count?: number;
}
export const Newline: React.FC<NewlineProps> = ({ count = 1 }) => React.createElement(Text, {}, "\n".repeat(count));

/**
 * Flexible spacer that fills available space in the parent flex container.
 * Ink-compatible: &lt;Spacer />
 */
export const Spacer: React.FC = () => React.createElement(Box, { flexGrow: 1 });

/**
 * Applies a string transformation to its children's text content.
 * The transform function receives the concatenated text of all children
 * and must return the transformed string.
 * Ink-compatible: &lt;Transform transform={s => s.toUpperCase()}>{children}&lt;/Transform>
 */
export interface TransformProps {
    children?: React.ReactNode;
    transform: (s: string, index: number) => string;
}
export const Transform: React.FC<TransformProps> = ({ children, transform }) => {
    if (children === undefined || children === null)
        return null;

    return React.createElement("box", { flexShrink: 1, transform }, children);
};

/**
 * Internal component that handles Tab/Shift+Tab for focus cycling.
 * Must live inside FocusProvider to access FocusContext.
 */
const TabHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { disableFocus, enableFocus, focusNext, focusPrevious } = useFocusManager();

    useInput((_input, key) => {
        if (key.tab && !key.shift)
            focusNext();

        if (key.tab && key.shift)
            focusPrevious();

        if (key.escape) {
            disableFocus();
            enableFocus();
        } // reset focus (Ink built-in)
    });

    return React.createElement(React.Fragment, null, children);
};

// Global mount utility
/** Ink-compat render options */
export interface RenderOptions {
    /** Ignored — Ratatat is always concurrent */
    concurrent?: boolean;
    /** Ignored */
    debug?: boolean;
    /** Ignored — Ctrl+C always exits */
    exitOnCtrlC?: boolean;
    /** Ignored */
    incrementalRendering?: boolean;
    /** Target frames per second for the render loop. Default: 60 */
    maxFps?: number;
    /** Ignored — Ratatat always patches console */
    patchConsole?: boolean;
}

/** Return value of render() — Ink-compatible instance handle */
export interface Instance {
    /** ratatat-internal: direct app access */
    app: RatatatApp;
    /** ratatat-internal: input parser */
    input: InputParser;
    rerender: (element: React.ReactElement) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
}

export function render(element: React.ReactElement, options?: RenderOptions): Instance {
    const app = new RatatatApp();
    const input = new InputParser(process.stdin);

    const rootNode = new LayoutNode();
    const { height, width } = app.getSize();

    rootNode.yogaNode.setWidth(width);
    rootNode.yogaNode.setHeight(height);

    // Hook Reconciler up to the root Yoga Node container
    const container = RatatatReconciler.createContainer(
        rootNode,
        0, // Legacy root
        null, // hydrate
        false,
        null,
        "", // prefix
        (error: Error) => console.error(error),
        null,
    );

    // Wrap element — reused on rerender()
    const wrap = (element_: React.ReactElement) =>
        React.createElement(
            RatatatContext.Provider,
            {
                value: {
                    app,
                    input,
                    writeStderr: (t: string) => app.writeStderr(t),
                    writeStdout: (t: string) => app.writeStdout(t),
                },
            },
            React.createElement(FocusProvider, null, React.createElement(TabHandler, null, element_)),
        );

    RatatatReconciler.updateContainer(wrap(element) as any, container, null, () => {});

    // Paint function: layout + render to buffer + Rust diff/write
    const calcLayout = (w: number, h: number) => rootNode.calculateLayout(w, h);
    const renderBuf = (buf: Uint32Array, w: number, h: number) => renderTreeToBuffer(rootNode, buf, w, h);
    const paintNow = () => app.paintNow(calcLayout, renderBuf);

    // Dirty flag: set on every React commit, cleared by the render loop.
    // Decouples painting from React's scheduler — no dependency on resetAfterCommit
    // firing reliably for timer-driven updates (setTimeout, setInterval, streaming).
    let pendingCommit = false;

    setOnAfterCommit(() => {
        pendingCommit = true;
    });

    // Render loop: polls at maxFps and paints whenever React has committed new state.
    // setInterval keeps the Node.js event loop alive so the React scheduler can
    // deliver timer-driven updates between user input events.
    const frameMs = Math.round(1000 / (options?.maxFps ?? 60));
    const renderLoop = setInterval(() => {
        if (pendingCommit) {
            pendingCommit = false;
            paintNow();
        }
    }, frameMs);

    // exitPromise: resolves when unmount() is called
    let resolveExit!: () => void;
    const exitPromise = new Promise<void>((resolve) => {
        resolveExit = resolve;
    });

    const cleanup = () => {
        clearInterval(renderLoop);
        app.stop();
        input.stop();
        process.off("SIGWINCH", onSigwinch);
        resolveExit();
    };

    // Ctrl+C: clean shutdown — restore terminal, stop stdin, exit
    input.on("exit", () => {
        cleanup();
        process.exit(0);
    });

    // app.quit(): programmatic clean exit from useApp()
    app.on("quit", () => {
        cleanup();
        process.exit(0);
    });

    input.start();
    app.start();

    // Handle terminal resize: update root node dimensions and repaint immediately
    const onSigwinch = () => {
        const width = process.stdout.columns || 80;
        const height = process.stdout.rows || 24;

        app.resize(width, height);
        rootNode.yogaNode.setWidth(width);
        rootNode.yogaNode.setHeight(height);
        app.emit("resize");
        paintNow();
    };

    process.on("SIGWINCH", onSigwinch);

    // Paint the initial frame (after start() sets isRunning = true)
    paintNow();

    return {
        // Internal access — not part of Ink's public API but useful for ratatat-native code
        app,
        input,
        /** Re-render with a new root element */
        rerender(newElement: React.ReactElement) {
            RatatatReconciler.updateContainer(wrap(newElement) as any, container, null, () => {});
        },
        /** Unmount the app and restore the terminal */
        unmount() {
            cleanup();
        },
        /** Resolves when unmount() is called or the app exits */
        waitUntilExit() {
            return exitPromise;
        },
    };
}

// ─── renderInline ─────────────────────────────────────────────────────────────

export interface InlineInstance {
    /** Unmount the React tree and stop the render loop */
    unmount: () => void;
    /** Resolves when the loop exits */
    waitUntilExit: () => Promise<void>;
}

/**
 * Render a React element inline — no alternate screen. The UI appears
 * directly below the current shell prompt and stays in terminal scrollback
 * on exit (or is destroyed if `onExit: 'destroy'` is set).
 *
 * The root Box is sized to `cols × rows`. Use `useInput` and `useApp`
 * exactly as in a full-screen render.
 * @example
 * ```tsx
 * const { waitUntilExit } = renderInline(<Picker />, { rows: 12, onExit: 'destroy' })
 * await waitUntilExit()
 * ```
 */
export function renderInline(element: React.ReactElement, options?: InlineOptions & { maxFps?: number }): InlineInstance {
    const size = terminalSize();
    const reservedRows = options?.rows ?? 10;
    const { cols } = size;
    const rows = Math.min(reservedRows, size.rows);

    const input = new InputParser(process.stdin);
    const rootNode = new LayoutNode();

    rootNode.yogaNode.setWidth(cols);
    rootNode.yogaNode.setHeight(rows);

    // Minimal app-like object: no alternate screen, just quit signal + writeStdout buffer
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const appLike = {
        quit: () => loop.stop(),
        writeStderr: (t: string) => stderrLines.push(t),
        writeStdout: (t: string) => stdoutLines.push(t),
    };

    const container = RatatatReconciler.createContainer(rootNode, 0, null, false, null, "", (error: Error) => console.error(error), null);

    const wrap = (element_: React.ReactElement) =>
        React.createElement(
            RatatatContext.Provider,
            {
                value: {
                    app: appLike as any,
                    input,
                    writeStderr: appLike.writeStderr,
                    writeStdout: appLike.writeStdout,
                },
            },
            React.createElement(FocusProvider, null, React.createElement(TabHandler, null, element_)),
        );

    RatatatReconciler.updateContainer(wrap(element) as any, container, null, () => {});

    let pendingCommit = false;

    setOnAfterCommit(() => {
        pendingCommit = true;
    });

    const loop = createInlineLoop(
        (buf, w, h) => {
            rootNode.calculateLayout(w, h);
            renderTreeToBuffer(rootNode, buf, w, h);
            pendingCommit = false;
        },
        { ...options, fps: options?.maxFps ?? options?.fps ?? 60, rows },
    );

    // Ctrl+C → clean exit
    input.on("exit", () => loop.stop());

    let resolveExit!: () => void;
    const exitPromise = new Promise<void>((r) => {
        resolveExit = r;
    });

    // Flush buffered stdout/stderr after the inline region is gone
    process.on("exit", () => {
        if (stdoutLines.length > 0)
            process.stdout.write(stdoutLines.join(""));

        if (stderrLines.length > 0)
            process.stderr.write(stderrLines.join(""));

        resolveExit();
    });

    loop.start();
    // Start InputParser AFTER loop.start() so the loop's CPR handler
    // gets registered on stdin first. InputParser adds its own 'data'
    // listener for keyboard input (useInput, useApp, etc).
    // Note: loop.start() already calls setRawMode(true) and stdin.resume(),
    // so InputParser.start() just adds its data listener (the duplicate
    // setRawMode/resume calls are harmless).
    input.start();

    return {
        unmount() {
            loop.stop();
        },
        waitUntilExit() {
            return exitPromise;
        },
    };
}
