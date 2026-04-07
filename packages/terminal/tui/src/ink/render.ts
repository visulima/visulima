/* eslint-disable @typescript-eslint/no-use-before-define */
import process from "node:process";
import { Stream } from "node:stream";

import type { ReactNode } from "react";

import type { DOMElement } from "./dom";
import type { Options as InkOptions, RenderMetrics } from "./ink";
import Ink from "./ink";
import instances from "./instances";
import type { KittyKeyboardOptions } from "./kitty-keyboard";

export type RenderOptions = {
    /**
     * Render the app in the terminal's alternate screen buffer. When enabled, the app renders on a separate screen, and the original terminal content is restored when the app exits. This is the same mechanism used by programs like vim, htop, and less.
     *
     * Note: The terminal's scrollback buffer is not available while in the alternate screen. This is standard terminal behavior; programs like vim use the alternate screen specifically to avoid polluting the user's scrollback history.
     *
     * Note: Ink intentionally treats alternate-screen teardown output as disposable. It does not preserve or replay teardown-time frames, hook writes, or `console.*` output after restoring the primary screen.
     *
     * Only works in interactive mode. Ignored when `interactive` is `false` or in a non-interactive environment (CI, piped stdout).
     *
     *Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.
     * @default false
     */
    alternateScreen?: boolean;

    /**
     * Enable React Concurrent Rendering mode.
     *
     * When enabled:
     * - Suspense boundaries work correctly with async data
     * - `useTransition` and `useDeferredValue` are fully functional
     * - Updates can be interrupted for higher priority work
     *
     *Note: Concurrent mode changes the timing of renders. Some tests may need to use `act()` to properly await updates. Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change the rendering mode or create a fresh instance.
     * @default false
     */
    concurrent?: boolean;

    /**
     * If true, each update will be rendered as separate output, without replacing the previous one.
     * @default false
     */
    debug?: boolean;

    /**
     * Configure whether Ink should listen for Ctrl+C keyboard input and exit the app. This is needed in case `process.stdin` is in raw mode, because then Ctrl+C is ignored by default and the process is expected to handle it manually.
     * @default true
     */
    exitOnCtrlC?: boolean;

    /**
     * Enable incremental rendering mode which only updates changed lines instead of redrawing the entire output.
     *This can reduce flickering and improve performance for frequently updating UIs.
     * @default false
     */
    incrementalRendering?: boolean;

    /**
     * Override automatic interactive mode detection.
     *
     * By default, Ink detects whether the environment is interactive based on CI detection (via [`is-in-ci`](https://github.com/sindresorhus/is-in-ci)) and `stdout.isTTY`. Most users should not need to set this.
     *
     * When non-interactive, Ink disables ANSI erase sequences, cursor manipulation, synchronized output, resize handling, and kitty keyboard auto-detection, writing only the final frame at unmount.
     *
     * Set to `false` to force non-interactive mode or `true` to force interactive mode when the automatic detection doesn't suit your use case.
     *
     *Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.
     * @default true (false if in CI or `stdout.isTTY` is falsy)
     */
    interactive?: boolean;

    /**
     * Enable screen reader support. See https://github.com/vadimdemedes/ink/blob/master/readme.md#screen-reader-support
     * @default process.env['INK_SCREEN_READER'] === 'true'
     */
    isScreenReaderEnabled?: boolean;

    /**
     * Configure kitty keyboard protocol support for enhanced keyboard input.
     * Enables additional modifiers (super, hyper, capsLock, numLock) and
     *disambiguated key events in terminals that support the protocol.
     * @see https://sw.kovidgoyal.net/kitty/keyboard-protocol/
     */
    kittyKeyboard?: KittyKeyboardOptions;

    /**
     * Maximum frames per second for render updates.
     * This controls how frequently the UI can update to prevent excessive re-rendering.
     *Higher values allow more frequent updates but may impact performance.
     * @default 30
     */
    maxFps?: number;

    /**
     * Runs the given callback after each render and re-render with render metrics.
     *
     * Note: this callback runs after Ink commits a frame, but it does not wait for `stdout`/`stderr` stream callbacks.
     * To run code after output is flushed, use `waitUntilRenderFlush()`.
     */
    onRender?: (metrics: RenderMetrics) => void;

    /**
     * Patch console methods to ensure console output doesn't mix with Ink's output.
     *
     *Note: Once unmount starts, Ink restores the native console before React cleanup runs. Teardown-time `console.*` output then follows the normal console behavior instead of being rerouted through Ink.
     * @default true
     */
    patchConsole?: boolean;

    /**
     * If true, Ink defers frame output until after React's commit phase completes,
     * ensuring `useLayoutEffect` hooks run before the frame is written to the terminal.
     *
     * This eliminates the one-frame flicker when components measure layout
     * (e.g., scroll position, element size) in `useLayoutEffect` and adjust state.
     *
     * **Warning:** Incompatible with the `&lt;Static>` component, which relies on
     * immediate render timing to append output.
     * @default false
     */
    standardReactLayoutTiming?: boolean;

    /**
     * Error stream.
     * @default process.stderr
     */
    stderr?: NodeJS.WriteStream;

    /**
     * Input stream where app will listen for input.
     * @default process.stdin
     */
    stdin?: NodeJS.ReadStream;

    /**
     * Output stream where the app will be rendered.
     * @default process.stdout
     */
    stdout?: NodeJS.WriteStream;

    /**
     * Use the native Rust cell-diff renderer for terminal output.
     * Produces a Uint32Array buffer that the Rust renderer diffs cell-by-cell,
     * generating minimal ANSI escape sequences. Reduces GC pressure and
     * improves rendering performance for complex UIs.
     *
     * Falls back to string-based rendering if native bindings are not available.
     * @default false
     */
    useNativeRenderer?: boolean;
};

export type Instance = {
    /**
     * Unmount the current app and remove the internal Ink instance for this stdout.
     *
     * This is mostly useful for advanced cases where you need `render()` to create a fresh instance for the same stream without leaving terminal state such as the alternate screen behind.
     */
    cleanup: () => void;

    /**
     * Clear output.
     */
    clear: () => void;

    /**
     * Replace the previous root node with a new one or update props of the current root node.
     */
    rerender: Ink["render"];

    /**
     * The root DOM element of the rendered tree.
     * Useful for programmatic DOM inspection and advanced measurement.
     */
    rootNode: DOMElement;

    /**
     * Manually unmount the whole Ink app.
     */
    unmount: Ink["unmount"];

    /**
     * Returns a promise that settles when the app is unmounted.
     *
     * It resolves with the value passed to `exit(value)` and rejects with the error passed to `exit(error)`.
     *When `unmount()` is called manually, it settles after unmount-related stdout writes complete.
     * @example
     * ```jsx
     * const {unmount, waitUntilExit} = render(<MyApp />);
     *
     * setTimeout(unmount, 1000);
     *
     * await waitUntilExit(); // resolves after `unmount()` is called
     * ```
     */
    waitUntilExit: Ink["waitUntilExit"];

    /**
     * Returns a promise that settles after pending render output is flushed to stdout.
     *
     *This can be used after `rerender()` when you need to run code only after the frame is written.
     * @example
     * ```jsx
     * const {rerender, waitUntilRenderFlush} = render(<MyApp step="loading" />);
     *
     * rerender(<MyApp step="ready" />);
     * await waitUntilRenderFlush(); // output for "ready" is flushed
     *
     * runNextCommand();
     * ```
     */
    waitUntilRenderFlush: Ink["waitUntilRenderFlush"];
};

/**
 * Mount a component and render the output.
 */
const render = (node: ReactNode, options?: NodeJS.WriteStream | RenderOptions): Instance => {
    const inkOptions: InkOptions = {
        alternateScreen: false,
        concurrent: false,
        debug: false,
        exitOnCtrlC: true,
        incrementalRendering: false,
        maxFps: 30,
        patchConsole: true,
        stderr: process.stderr,
        stdin: process.stdin,
        stdout: process.stdout,
        ...getOptions(options),
    };

    const instance: Ink = getInstance(inkOptions.stdout, () => new Ink(inkOptions));

    instance.render(node);

    return {
        cleanup() {
            instance.unmount();
        },
        clear() {
            instance.clear();
        },
        rerender(n: ReactNode) {
            instance.render(n);
        },
        rootNode: instance.rootNode,
        unmount() {
            instance.unmount();
        },
        waitUntilExit() {
            return instance.waitUntilExit();
        },
        waitUntilRenderFlush() {
            return instance.waitUntilRenderFlush();
        },
    };
};

export default render;

const getOptions = (stdout: NodeJS.WriteStream | RenderOptions | undefined = {}): RenderOptions => {
    if (stdout instanceof Stream) {
        return {
            stdin: process.stdin,
            stdout,
        };
    }

    return stdout;
};

const getInstance = (stdout: NodeJS.WriteStream, createInstance: () => Ink): Ink => {
    const instance = instances.get(stdout);

    if (instance === undefined) {
        const newInstance = createInstance();

        instances.set(stdout, newInstance);

        return newInstance;
    }

    // Ink keeps one live renderer per stdout. Reusing the same stream without
    // unmounting is unsupported, but return the existing instance so we don't
    // create two renderers that compete for the same output. Write the warning
    // directly to native stderr so an existing alternate-screen renderer cannot
    // swallow it via patchConsole.
    process.stderr.write(
        "Warning: render() was called again for the same stdout before the previous Ink instance was unmounted. Reusing stdout across multiple render() calls is unsupported. Call unmount() first.\n",
    );

    return instance;
};
