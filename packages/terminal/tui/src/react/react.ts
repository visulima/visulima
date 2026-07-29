/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/naming-convention, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-explicit-any, @typescript-eslint/no-shadow, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-use-before-define, jsdoc/match-description, no-console, promise/param-names, sonarjs/no-dead-store, unicorn/no-null, unicorn/no-process-exit, unused-imports/no-unused-vars */
// @ts-nocheck — reconciler createContainer arity varies between React versions
import React from "react";

import type { InlineOptions } from "../core/index";
import { createInlineLoop, InputParser, terminalSize, TuiApp } from "../core/index";
import { FocusProvider, useFocusManager } from "./focus";
import { TuiContext, useInput } from "./hooks";
import { LayoutNode } from "./layout";
import { registerAfterCommit, TuiReconciler, unregisterAfterCommit } from "./reconciler";
import { renderTreeToBuffer } from "./renderer";

// ─── Internal element creators ──────────────────────────────────────────────
// These are thin wrappers for the native reconciler's "box"/"text" element types.
// They are NOT exported — public consumers import components from @visulima/tui (ink).
// Internal code (DevTools, TabHandler, Static) uses these to create native elements.

/** @internal */
export const _Box: React.FC<Record<string, any>> = (props) => React.createElement("box", props, props.children);
/** @internal */
export const _Text: React.FC<Record<string, any>> = (props) => React.createElement("text", props, props.children);
/** @internal */
export const _Spacer: React.FC = () => React.createElement(_Box, { flexGrow: 1 });

/**
 * Internal component that handles Tab/Shift+Tab for focus cycling.
 * Must live inside FocusProvider to access FocusContext.
 */
const TabHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { disableFocus, enableFocus, focusNext, focusPrevious } = useFocusManager();

    useInput((_input, key) => {
        if (key.tab && !key.shift) {
            focusNext();
        }

        if (key.tab && key.shift) {
            focusPrevious();
        }

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
    /** Ignored — the native renderer is always concurrent */
    concurrent?: boolean;
    /** Ignored */
    debug?: boolean;
    /** Ignored — Ctrl+C always exits */
    exitOnCtrlC?: boolean;
    /** Ignored */
    incrementalRendering?: boolean;
    /** Target frames per second for the render loop. Default: 60 */
    maxFps?: number;
    /** Ignored — the native renderer always patches console */
    patchConsole?: boolean;
}

/** Return value of render() — Ink-compatible instance handle */
export interface Instance {
    /** Internal: direct app access */
    app: TuiApp;
    /** Internal: input parser */
    input: InputParser;
    rerender: (element: React.ReactElement) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
}

export function render(element: React.ReactElement, options?: RenderOptions): Instance {
    const app = new TuiApp();
    const input = new InputParser(process.stdin);

    const rootNode = new LayoutNode();
    const { height, width } = app.getSize();

    rootNode.yogaNode.setWidth(width);
    rootNode.yogaNode.setHeight(height);

    // Hook Reconciler up to the root Yoga Node container
    const container = TuiReconciler.createContainer(
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
            TuiContext.Provider,
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

    TuiReconciler.updateContainer(wrap(element) as any, container, null, () => {});

    // Paint function: layout + render to buffer + Rust diff/write
    const calcLayout = (w: number, h: number) => rootNode.calculateLayout(w, h);
    const renderBuf = (buf: Uint32Array, w: number, h: number) => renderTreeToBuffer(rootNode, buf, w, h);
    const paintNow = () => app.paintNow(calcLayout, renderBuf);

    // Dirty flag: set on every React commit, cleared by the render loop.
    // Decouples painting from React's scheduler — no dependency on resetAfterCommit
    // firing reliably for timer-driven updates (setTimeout, setInterval, streaming).
    let pendingCommit = false;

    registerAfterCommit(rootNode, () => {
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
        unregisterAfterCommit(rootNode);
        // Unmount the React tree so effects/subscriptions are cleaned up,
        // then free the root Yoga node to avoid native memory leaks.
        TuiReconciler.updateContainer(null as any, container, null, () => {});
        rootNode.destroy();
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
        // Internal access — not part of Ink's public API but useful for native renderer code
        app,
        input,
        /** Re-render with a new root element */
        rerender(newElement: React.ReactElement) {
            TuiReconciler.updateContainer(wrap(newElement) as any, container, null, () => {});
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

    const container = TuiReconciler.createContainer(rootNode, 0, null, false, null, "", (error: Error) => console.error(error), null);

    const wrap = (element_: React.ReactElement) =>
        React.createElement(
            TuiContext.Provider,
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

    TuiReconciler.updateContainer(wrap(element) as any, container, null, () => {});

    let pendingCommit = false;

    registerAfterCommit(rootNode, () => {
        pendingCommit = true;
    });

    let resolveExit!: () => void;
    const exitPromise = new Promise<void>((r) => {
        resolveExit = r;
    });

    // Teardown: unmount the React tree, free native memory, detach input, and
    // resolve waitUntilExit — WITHOUT killing the host process. Runs exactly
    // once, whether triggered by unmount(), app.quit(), or Ctrl+C.
    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) {
            return;
        }

        cleanedUp = true;

        unregisterAfterCommit(rootNode);
        TuiReconciler.updateContainer(null as any, container, null, () => {});
        rootNode.destroy();
        input.stop();

        // Flush buffered stdout/stderr after the inline region is gone.
        if (stdoutLines.length > 0) {
            process.stdout.write(stdoutLines.join(""));
        }

        if (stderrLines.length > 0) {
            process.stderr.write(stderrLines.join(""));
        }

        resolveExit();
    };

    const loop = createInlineLoop(
        (buf, w, h) => {
            rootNode.calculateLayout(w, h);
            renderTreeToBuffer(rootNode, buf, w, h);
            pendingCommit = false;
        },
        // onStop runs after the loop restores the terminal — hand control back
        // to us so we can tear down React state instead of exiting the process.
        { ...options, fps: options?.maxFps ?? options?.fps ?? 60, onStop: cleanup, rows },
    );

    // Ctrl+C → stop the loop, which triggers onStop (cleanup) — no process exit
    input.on("exit", () => loop.stop());

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
