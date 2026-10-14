/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-use-before-define, @typescript-eslint/unbound-method, class-methods-use-this, e18e/prefer-static-regex, import/no-namespace, jsdoc/no-undefined-types, jsdoc/tag-lines, no-empty, no-void, react-x/no-context-provider, sonarjs/different-types-comparison, sonarjs/no-async-constructor */
import { Console as NodeConsole } from "node:console";
import process from "node:process";

import { ALT_SCREEN_OFF, ALT_SCREEN_ON, clearScreenAndHomeCursor, cursorHide, cursorShow, eraseLines } from "@visulima/ansi";
import { wordWrap } from "@visulima/string";
import isInCi from "is-in-ci";
import patchConsole from "patch-console";
import type { ReactNode } from "react";
import type { FiberRoot } from "react-reconciler";
import { ConcurrentRoot, LegacyRoot } from "react-reconciler/constants";
import { onExit as signalExit } from "signal-exit";
import Yoga from "yoga-layout";

import { accessibilityContext as AccessibilityContext } from "../components/accessibility-context";
import App from "../components/app";
import type { TerminalSuspension } from "../components/app-context";
import { composeBackbufferSlice } from "./backbuffer";
import * as dom from "./dom";
import instances from "./instances";
import type { KittyFlagName, KittyKeyboardOptions } from "./kitty-keyboard";
import { resolveFlags } from "./kitty-keyboard";
import type { CursorPosition, LogUpdate } from "./log-update";
import logUpdate from "./log-update";
import type { NativeLogUpdate } from "./log-update-native";
import { createNative } from "./log-update-native";
import { clearStyledLineCache } from "./measure-text";
import runExclusiveProbe from "./probe-terminal";
import reconciler from "./reconciler";
import { renderToStatic } from "./render-node-to-output";
import render from "./renderer";
import type ResizeObserver from "./resize-observer";
import type { ResizeObserverEntry } from "./resize-observer";
import { measureAndExtractObservers } from "./resize-observer";
import { calculateScroll } from "./scroll";
import applyStyles from "./styles";
import { getWindowSize } from "./utils";
// autoBind removed — only methods passed as callbacks need binding,
// and those are defined as arrow function properties.
import type { ThrottledFunction } from "./utils/throttle";
import { throttle } from "./utils/throttle";
import { bsu, esu, shouldSynchronize } from "./write-synchronized";

// Ensure console.Console is available for patch-console (Vitest and some test
// environments replace the global console without exposing Console as a constructor).
if (!(console as any).Console) {
    (console as any).Console = NodeConsole;
}

const noop = () => {};

// Terminal rows a block of text occupies once written: each newline ends a row, and unterminated text takes one more.
const countLines = (text: string): number => {
    if (text === "") {
        return 0;
    }

    const lines = text.split("\n").length;

    return text.endsWith("\n") ? lines - 1 : lines;
};

// The newest `rows` lines of a block of text, each newline-terminated. The alternate screen keeps no scrollback, so older lines are dropped.
const tailLines = (text: string, rows: number): string => {
    if (rows <= 0 || text === "") {
        return "";
    }

    const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");

    return lines.slice(-rows).map((line) => `${line}\n`).join("");
};

// React.memo cannot skip App re-render because `children` changes on every
// rerender. The App's ~40 hooks run every time. This is architectural — the
// only way to avoid it would be to move App's hook logic out of React.

const yieldImmediate = async () =>
    new Promise<void>((resolve) => {
        setImmediate(resolve);
    });

const shouldClearTerminalForFrame = ({
    isTty,
    isUnmounting,
    isWindows,
    nextOutputHeight,
    previousOutputHeight,
    viewportRows,
}: {
    isTty: boolean;
    isUnmounting: boolean;
    isWindows: boolean;
    nextOutputHeight: number;
    previousOutputHeight: number;
    viewportRows: number;
}): boolean => {
    if (!isTty) {
        return false;
    }

    const isHadPreviousFrame = previousOutputHeight > 0;
    const wasFullscreen = previousOutputHeight >= viewportRows;
    const isFullscreen = nextOutputHeight >= viewportRows;
    const wasOverflowing = previousOutputHeight > viewportRows;
    const isOverflowing = nextOutputHeight > viewportRows;
    const isLeavingFullscreen = wasFullscreen && nextOutputHeight < viewportRows;
    const shouldClearOnUnmount = isUnmounting && wasFullscreen;
    // Windows consoles scroll the buffer immediately when the bottom-right cell
    // is written, whereas Unix-like terminals defer the wrap until the next
    // character. The incremental eraseLines redraw path assumes deferred wrap,
    // so on Windows the cursor arithmetic drifts one row per frame and stale
    // fullscreen frames leak through. Force a full clear for any fullscreen
    // frame on Windows. See vadimdemedes/ink#971.
    const isWindowsFullscreenRedraw = isWindows && (isFullscreen || wasFullscreen);

    return (
        // Overflowing frames still need full clear fallback.
        wasOverflowing
        || (isOverflowing && isHadPreviousFrame)
        // Clear when shrinking from fullscreen to non-fullscreen output.
        || isLeavingFullscreen
        // Preserve legacy unmount behavior for fullscreen frames: final teardown
        // render should clear once to avoid leaving a scrolled viewport state.
        || shouldClearOnUnmount
        || isWindowsFullscreenRedraw
    );
};

const isErrorInput = (value: unknown): value is Error => value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";

type MaybeWritableStream = NodeJS.WriteStream & {
    _writableState?: unknown;
    destroyed?: boolean;
    writable?: boolean;
    writableEnded?: boolean;
    writableLength?: number;
};

const getWritableStreamState = (stdout: MaybeWritableStream) => {
    const canWriteToStdout = !stdout.destroyed && !stdout.writableEnded && (stdout.writable ?? true);
    const hasWritableState = stdout._writableState !== undefined || stdout.writableLength !== undefined;

    return {
        canWriteToStdout,
        hasWritableState,
    };
};

const settleThrottle = (throttled: unknown, canWriteToStdout: boolean): void => {
    if (!throttled || typeof (throttled as { flush?: unknown }).flush !== "function") {
        return;
    }

    const throttledValue = throttled as {
        cancel?: () => void;
        flush: () => void;
    };

    if (canWriteToStdout) {
        throttledValue.flush();
    } else if (typeof throttledValue.cancel === "function") {
        throttledValue.cancel();
    }
};

/**
 * Performance metrics for a render operation.
 */
export type RenderMetrics = {
    /**
     * Time spent rendering in milliseconds.
     */
    renderTime: number;
};

export type Options = {
    /**
     * Render the app in the terminal's alternate screen buffer. When enabled, the app renders on a separate screen, and the original terminal content is restored when the app exits. This is the same mechanism used by programs like vim, htop, and less.
     *
     * Note: The terminal's scrollback buffer is not available while in the alternate screen. This is standard terminal behavior; programs like vim use the alternate screen specifically to avoid polluting the user's scrollback history.
     *
     * Note: Ink intentionally treats alternate-screen teardown output as disposable. It does not preserve or replay teardown-time frames, hook writes, or `console.*` output after restoring the primary screen.
     *
     * Only works in interactive mode. Ignored when `interactive` is `false` or in a non-interactive environment (CI, piped stdout).
     *
     * Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.
     *
     * @default false
     *
     * @see {@link RenderOptions.alternateScreen}
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
     * Note: Concurrent mode changes the timing of renders. Some tests may need to use `act()` to properly await updates. Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change the rendering mode or create a fresh instance.
     *
     * @default false
     * @experimental
     */
    concurrent?: boolean;
    debug: boolean;
    exitOnCtrlC: boolean;
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
     * Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.
     *
     * @default true (false if in CI or `stdout.isTTY` is falsy)
     *
     * @see {@link RenderOptions.interactive}
     */
    interactive?: boolean;
    isScreenReaderEnabled?: boolean;
    kittyKeyboard?: KittyKeyboardOptions;
    maxFps?: number;
    onRender?: (metrics: RenderMetrics) => void;
    patchConsole: boolean;
    standardReactLayoutTiming?: boolean;

    stderr: NodeJS.WriteStream;

    stdin: NodeJS.ReadStream;

    stdout: NodeJS.WriteStream;

    /**
     * Whether to track text selection state during rendering.
     *
     * @default false
     */
    trackSelection?: boolean;

    /**
     * Use the native Rust cell-diff renderer instead of ANSI string-based log-update.
     * Produces a Uint32Array buffer that the Rust renderer diffs cell-by-cell,
     * generating minimal ANSI escape sequences. Significantly reduces GC pressure
     * and improves rendering performance for complex UIs.
     *
     * Applies to interactive output on a TTY, on the alternate screen or inline. Non-TTY, screen-reader and debug output,
     * and setups where native bindings are not available, use the string-based path.
     * @default false
     */
    useNativeRenderer?: boolean;

    waitUntilExit?: () => Promise<unknown>;
};

export default class Ink {
    /**
     * Whether this instance is using concurrent rendering mode.
     */
    readonly isConcurrent: boolean;

    private readonly options: Options;

    private readonly log: LogUpdate;

    private manualCursorPosition: CursorPosition | undefined;

    private renderedCursorPosition: CursorPosition | undefined;

    private renderedCursorRequested: boolean;

    private readonly throttledLog: LogUpdate | ThrottledFunction<(output: string) => void>;

    private readonly isScreenReaderEnabled: boolean;

    private readonly interactive: boolean;

    private readonly renderThrottleMs: number;

    private alternateScreen: boolean;

    // Ignore last render after unmounting a tree to prevent empty output before exit
    private isUnmounted: boolean;

    private isUnmounting: boolean;

    private lastOutput: string;

    private lastOutputToRender: string;

    private lastOutputHeight: number;

    /** Set by clear(): the frame has been erased and must be drawn again by the next render. */
    private isFrameCleared: boolean;

    private lastTerminalWidth: number;

    private lastTerminalRows: number;

    private readonly nativeLog: NativeLogUpdate | undefined;

    // The last frame the native renderer drew, kept so it can be drawn again after external writes.
    private lastNativeFrame: { buffer: Uint32Array; cursor: CursorPosition | undefined; height: number; width: number } | undefined;

    // Terminal rows taken by static output and scrolled-off lines above the native frame.
    private nativeRowOffset = 0;

    // Set when something outside the frame may have changed the screen (a resize or a resume), so the next native frame redraws all of it.
    private nativeScreenStale = false;

    private readonly useNativeRenderer: boolean;

    private readonly container: FiberRoot;

    public readonly rootNode: dom.DOMElement;

    // This variable is used only in debug mode to store full static output
    // so that it's rerendered every time, not just new static parts, like in non-debug mode
    private fullStaticOutput: string;

    // Whether <Static> output has been written since the last identity change, on any render path.
    private staticOutputWritten = false;

    // The single scrollable node with `overflowToBackbuffer` enabled, detected
    // during the layout/scroll walk. Only one such region is supported.
    private backbufferNode: dom.DOMElement | undefined;

    // Emit the "multiple overflowToBackbuffer regions" diagnostic at most once
    // per instance (the layout/scroll walk runs every frame).
    private backbufferMultiWarned = false;

    private readonly exitPromise!: Promise<unknown>;

    private exitResult: unknown;

    private beforeExitHandler?: () => void;

    private restoreConsole?: () => void;

    private unsubscribeResize?: () => void;

    private readonly throttledOnRender?: ThrottledFunction<() => void>;

    private hasPendingThrottledRender = false;

    private kittyProtocolEnabled = false;

    // Flags the kitty protocol was enabled with, remembered so suspendTerminal()
    // can reinstate the exact same protocol on resume.
    private kittyFlags?: KittyFlagName[];

    // The suspension that currently owns the terminal, set while suspendTerminal() has handed it to a child process.
    private activeSuspension?: object;

    // Input pause/resume hooks registered by the App component, which owns raw
    // mode and bracketed paste state.
    private pauseInput?: () => void;

    private resumeInput?: () => void;

    private finishKittyDetection?: (supported: boolean) => void;

    private nextRenderCommit?: { promise: Promise<void>; resolve: () => void };

    private deferredInitDone = false;

    constructor(options: Options) {
        this.options = options;
        this.rootNode = dom.createNode("ink-root");
        this.rootNode.onComputeLayout = this.calculateLayout;

        this.isScreenReaderEnabled = options.isScreenReaderEnabled ?? process.env["INK_SCREEN_READER"] === "true";

        // CI detection takes precedence: even a TTY stdout in CI defaults to non-interactive.
        // Using Boolean(isTTY) (rather than an 'in' guard) correctly handles piped streams
        // where the property is absent (e.g. `node app.js | cat`).
        this.interactive = this.resolveInteractiveOption(options.interactive);

        this.alternateScreen = false;

        const isUnthrottled = options.debug || this.isScreenReaderEnabled;
        const maxFps = options.maxFps ?? 30;
        const renderThrottleMs = maxFps > 0 ? Math.max(1, Math.ceil(1000 / maxFps)) : 0;

        this.renderThrottleMs = isUnthrottled ? 0 : renderThrottleMs;

        const baseOnRender = isUnthrottled
            ? this.onRender
            : (() => {
                const throttled = throttle(this.onRender, renderThrottleMs, {
                    leading: true,
                    trailing: true,
                });

                this.throttledOnRender = throttled;

                return () => {
                    this.hasPendingThrottledRender = true;
                    throttled();
                };
            })();

        if (isUnthrottled) {
            this.throttledOnRender = undefined;
        } else {
            // throttledOnRender already set above
        }

        // When standardReactLayoutTiming is enabled, coalesce render calls
        // via queueMicrotask so multiple React state updates in the same tick
        // produce a single frame, and useLayoutEffect hooks complete before the
        // frame is written to the terminal.
        if (options.standardReactLayoutTiming) {
            let isRenderScheduled = false;
            const deferredRender = () => {
                if (isRenderScheduled) {
                    return;
                }

                isRenderScheduled = true;
                queueMicrotask(() => {
                    isRenderScheduled = false;
                    this.onRender();
                });
            };

            this.rootNode.onRender = deferredRender;
            this.rootNode.onImmediateRender = deferredRender;
        } else {
            this.rootNode.onRender = baseOnRender;
            this.rootNode.onImmediateRender = this.onRender;
        }

        this.rootNode.onStaticChange = this.handleStaticChange;

        this.log = logUpdate.create(options.stdout, {
            incremental: options.incrementalRendering,
        });

        // Initialize native (Rust) renderer if requested and available. Non-TTY and screen-reader output are plain
        // text, so they keep the string renderer. Inline frames are drawn from the cursor's row (see log-update-native).
        this.useNativeRenderer = (options.useNativeRenderer ?? false)
            && this.interactive
            && options.stdout.isTTY
            && !this.isScreenReaderEnabled
            && !options.debug;

        if (this.useNativeRenderer) {
            this.nativeLog = createNative(options.stdout, { inline: !options.alternateScreen });

            if (!this.nativeLog) {
                // Fall back to string path if native binding unavailable
                this.useNativeRenderer = false;
            }
        }

        this.manualCursorPosition = undefined;
        this.renderedCursorPosition = undefined;
        this.renderedCursorRequested = false;
        this.throttledLog = isUnthrottled
            ? this.log
            : throttle(
                (output: string) => {
                    const shouldWrite = this.log.willRender(output);
                    const isSync = this.shouldSync();

                    if (isSync && shouldWrite) {
                        this.options.stdout.write(bsu);
                    }

                    this.log(output);

                    if (isSync && shouldWrite) {
                        this.options.stdout.write(esu);
                    }
                },
                undefined,
                {
                    leading: true,
                    trailing: true,
                },
            );

        // Ignore last render after unmounting a tree to prevent empty output before exit
        this.isUnmounted = false;
        this.isUnmounting = false;

        // Store concurrent mode setting
        this.isConcurrent = options.concurrent ?? false;

        // Store last output to only rerender when needed
        this.lastOutput = "";
        this.lastOutputToRender = "";
        this.lastOutputHeight = 0;
        this.isFrameCleared = false;
        const initialSize = getWindowSize(this.options.stdout);

        this.lastTerminalWidth = initialSize.columns;
        this.lastTerminalRows = initialSize.rows;

        // This variable is used only in debug mode to store full static output
        // so that it's rerendered every time, not just new static parts, like in non-debug mode
        this.fullStaticOutput = "";

        // Use ConcurrentRoot for concurrent mode, LegacyRoot for legacy mode
        const rootTag = options.concurrent ? ConcurrentRoot : LegacyRoot;

        this.container = reconciler.createContainer(
            this.rootNode,
            rootTag,
            null,
            false,
            null,
            "id",
            () => {},
            () => {},
            () => {},
            () => {},
        );

        // Unmount when process exits
        this.unsubscribeExit = signalExit(this.unmount, { alwaysLast: false });

        this.setAlternateScreen(Boolean(options.alternateScreen));

        if (options.patchConsole) {
            this.patchConsole();
        }

        if (this.interactive) {
            options.stdout.on("resize", this.resized);

            this.unsubscribeResize = () => {
                options.stdout.off("resize", this.resized);
            };
        }

        // Kitty "enabled" mode runs immediately (just a stdout.write).
        // "auto" mode detection is deferred to the first render frame via
        // runDeferredInit() because the CSI ? u query sets up a stdin
        // listener with a 200ms timeout.
        this.initImmediateKittyKeyboard();

        if (process.env["DEV"] === "true") {
            // @ts-expect-error outdated types
            reconciler.injectIntoDevTools();
        }

        this.exitPromise = new Promise((resolve, reject) => {
            this.resolveExitPromise = resolve;
            this.rejectExitPromise = reject;
        });
        // Prevent global unhandled-rejection crashes when app code exits with an
        // error but consumers never call waitUntilExit().

        void this.exitPromise.catch(noop);
    }

    /**
     * Perform deferred initialization on the first render frame.
     * Kitty keyboard auto-detection is deferred here because the CSI ? u
     * query sets up a synchronous stdin listener with a 200ms timeout.
     * "enabled" mode runs immediately in the constructor (it's just a write).
     */
    private runDeferredInit(): void {
        if (this.deferredInitDone) {
            return;
        }

        this.deferredInitDone = true;

        this.initDeferredKittyKeyboard();
    }

    resized = (): void => {
        const { columns: currentWidth, rows: currentRows } = getWindowSize(this.options.stdout);

        if (currentWidth < this.lastTerminalWidth || currentRows < this.lastTerminalRows) {
            // Shrinking the terminal re-wraps or scrolls the frame, so the log no longer knows where it is.
            // We clear the frame and draw it again to prevent duplicate overlapping re-renders.
            this.eraseFrame();
            this.nativeScreenStale = true;
            this.lastOutput = "";
            this.lastOutputToRender = "";
            this.lastOutputHeight = 0;
        }

        // Clear styled line cache on resize — cached measurements may be
        // stale for the new terminal width.
        clearStyledLineCache();

        this.calculateLayout();
        // Fan out to useBoxMetrics consumers via the shared layout-listener channel
        // instead of having each hook subscribe to stdout 'resize' directly — N consumers
        // would otherwise trip Node's default 10-listener cap (MaxListenersExceededWarning).
        dom.emitLayoutListeners(this.rootNode);
        this.onRender();

        this.lastTerminalWidth = currentWidth;
        this.lastTerminalRows = currentRows;
    };

    resolveExitPromise: (result?: unknown) => void = () => {};

    rejectExitPromise: (reason?: Error) => void = () => {};

    unsubscribeExit: () => void = () => {};

    handleAppExit = (errorOrResult?: unknown): void => {
        if (this.isUnmounted || this.isUnmounting) {
            return;
        }

        if (isErrorInput(errorOrResult)) {
            this.unmount(errorOrResult);

            return;
        }

        this.exitResult = errorOrResult;
        this.unmount();
    };

    getActiveCursorPosition = (): CursorPosition | undefined => {
        if (this.renderedCursorRequested) {
            return this.renderedCursorPosition;
        }

        return this.manualCursorPosition;
    };

    setCursorPosition = (position: CursorPosition | undefined): void => {
        this.manualCursorPosition = position;
        this.log.setCursorPosition(this.getActiveCursorPosition());
    };

    restoreLastOutput = (): void => {
        // A cleared frame stays cleared until the next render draws it again.
        if (!this.interactive || this.isFrameCleared) {
            return;
        }

        // A native frame cannot be replayed as text: draw it again from the last buffer, so
        // whatever the external write put on screen is overwritten.
        if (this.nativeLog) {
            if (this.lastNativeFrame) {
                const { buffer, cursor, height, width } = this.lastNativeFrame;

                this.nativeLog.destroy();
                this.nativeLog.render(buffer, width, height, { cursor, rowOffset: this.nativeRowOffset });
            }

            return;
        }

        // Screen-reader frames are written as plain text, so restore them the same way and
        // only sync log-update's bookkeeping: no cursor hide or placement.
        if (this.isScreenReaderEnabled) {
            this.options.stdout.write(this.lastOutputToRender);
            this.log.setCursorPosition(undefined);
            this.log.sync(this.lastOutputToRender);

            return;
        }

        // Clear() resets log-update's cursor state, so replay the latest cursor intent
        // before restoring output after external stdout/stderr writes.
        this.log.setCursorPosition(this.getActiveCursorPosition());
        this.log(this.lastOutputToRender || `${this.lastOutput}\n`);
    };

    calculateLayout = (): void => {
        // The root Yoga node is freed on unmount; a commit that lands afterwards has nothing to lay out.
        if (!this.rootNode.yogaNode) {
            return;
        }

        const flushLayoutObservers = (node: dom.DOMElement): void => {
            const observerEntries = new Map<ResizeObserver, ResizeObserverEntry[]>();

            this.calculateScrollAndTriggerObservers(node, observerEntries);

            for (const [observer, entries] of observerEntries) {
                observer.internalTrigger(entries);
            }
        };

        // Re-detected each layout pass by calculateScrollAndTriggerObservers;
        // cleared here so an unmounted backbuffer region doesn't linger.
        this.backbufferNode = undefined;

        this.prepareYogaTree(this.rootNode, flushLayoutObservers);

        const terminalWidth = getWindowSize(this.options.stdout).columns;

        this.rootNode.yogaNode.setWidth(terminalWidth);

        this.rootNode.yogaNode.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

        flushLayoutObservers(this.rootNode);
    };

    private calculateScrollAndTriggerObservers(node: dom.DOMElement, observerEntries: Map<ResizeObserver, ResizeObserverEntry[]>): void {
        if (node.nodeName === "ink-box") {
            const { style } = node;
            const overflow = style.overflow ?? "visible";
            const overflowX = style.overflowX ?? overflow;
            const overflowY = style.overflowY ?? overflow;

            if (overflowX === "scroll" || overflowY === "scroll") {
                calculateScroll(node);

                if (style.overflowToBackbuffer) {
                    if (this.backbufferNode && this.backbufferNode !== node && !this.backbufferMultiWarned) {
                        this.backbufferMultiWarned = true;
                        // eslint-disable-next-line no-console
                        console.warn(
                            "[@visulima/tui] Multiple scrollable regions have `overflowToBackbuffer` enabled; only one is supported. The last one in render order wins.",
                        );
                    }

                    this.backbufferNode = node;
                }
            } else if (node.internal_scrollState) {
                delete node.internal_scrollState;
            }
        }

        measureAndExtractObservers(node, observerEntries);

        // Skip traversal into static subtrees
        if (node.internal_static) {
            return;
        }

        for (const child of node.childNodes) {
            if (child.nodeName !== "#text") {
                this.calculateScrollAndTriggerObservers(child, observerEntries);
            }
        }
    }

    /**
     * Force a full layout recalculation by marking all text nodes dirty.
     * Useful when the string width function changes or terminal font changes.
     */
    // fallow-ignore-next-line unused-class-member -- public Ink API, not called inside the repo.
    recalculateLayout(): void {
        this.markAllTextNodesDirty(this.rootNode);
        this.calculateLayout();
        this.onRender();
    }

    /**
     * Walks the DOM tree before Yoga layout to handle StaticRender nodes.
     *
     * - Re-attach Yoga children if a cached render was invalidated.
     * - Pre-render ink-static-render nodes that don't have a cached render yet.
     */
    private prepareYogaTree(node: dom.DOMElement, flushLayoutObservers: (node: dom.DOMElement) => void): void {
        // Re-attach Yoga children if the cached render was invalidated
        if (node.isYogaTreeDetached && !node.cachedRender && node.yogaNode) {
            // Re-apply styles to revert any fixed width/height set by setCachedRender
            node.yogaNode.setWidthAuto();
            node.yogaNode.setHeightAuto();
            applyStyles(node.yogaNode, node.style);

            while (node.yogaNode.getChildCount() > 0) {
                // yoga-layout's Node type lacks `.remove()` but runtime has it.

                (node.yogaNode.getChild(0) as unknown as { remove: () => void }).remove();
            }

            let yogaIndex = 0;

            for (const child of node.childNodes) {
                const domChild = child as dom.DOMElement;

                if (child.nodeName !== "#text" && domChild.yogaNode) {
                    node.yogaNode.insertChild(domChild.yogaNode, yogaIndex);
                    yogaIndex++;
                }
            }

            node.isYogaTreeDetached = false;
            this.markAllTextNodesDirty(node);
        }

        // Recurse into children
        for (const child of node.childNodes) {
            if (child.nodeName !== "#text") {
                this.prepareYogaTree(child, flushLayoutObservers);
            }
        }

        // Pre-render ink-static-render nodes that don't have a cached render
        if (node.nodeName === "ink-static-render" && !node.cachedRender) {
            const terminalWidth = getWindowSize(this.options.stdout).columns;
            const { width } = node.style;

            if (node.yogaNode) {
                node.yogaNode.setWidth(typeof width === "number" ? width : terminalWidth);
                node.yogaNode.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            }

            flushLayoutObservers(node);
            renderToStatic(node, {
                skipStaticElements: false,
                trackSelection: this.options.trackSelection,
            });

            // Notify the StaticRender component that the cache is ready so it
            // can stop rendering children (avoids React re-reconciling the
            // subtree on subsequent renders).
            node.internal_onRendered?.();
        }
    }

    private markAllTextNodesDirty(node: dom.DOMElement): void {
        if (node.cachedRender) {
            return;
        }

        if (node.nodeName === "ink-text" && node.yogaNode) {
            node.yogaNode.markDirty();
        }

        for (const child of node.childNodes) {
            if (child.nodeName !== "#text") {
                this.markAllTextNodesDirty(child);
            }
        }
    }

    // Resets `fullStaticOutput` when the <Static> identity changes so stale items from a previous instance are not replayed on future rewrites.
    handleStaticChange = (): void => {
        this.fullStaticOutput = "";
        this.staticOutputWritten = false;
    };

    /**
     * Compute the slice of lines that newly scrolled off the top of the single
     * `overflowToBackbuffer` region and have not yet been flushed into the
     * terminal's real scrollback. Advances the monotonic
     * `internal_maxPushedScrollTop` bookkeeping so each line is emitted exactly
     * once and scrolling back up is a no-op. Returns a newline-terminated
     * string to write above the live frame, or "" when there is nothing to do.
     *
     * No-op outside inline mode (alternate-screen / non-TTY / non-interactive /
     * screen-reader / debug), since terminal scrollback only exists for an
     * inline, in-place-updated live region. Debug mode is excluded because it
     * re-dumps the full grid every frame and never writes this slice — running
     * it there would advance the monotonic pointer past lines that were never
     * emitted.
     */
    private computeBackbufferOutput(): string {
        const node = this.backbufferNode;

        if (
            !node?.internal_scrollState
            || !this.interactive
            || !this.options.stdout.isTTY
            || this.alternateScreen
            || this.isScreenReaderEnabled
            || this.options.debug
        ) {
            return "";
        }

        const scrollTop = Math.round(node.internal_scrollState.scrollTop);

        // The box's top padding pushes content down inside the clip, so the
        // first still-visible content row is `scrollTop - paddingTop`, not
        // `scrollTop`. Only rows strictly above that have actually scrolled
        // off; flushing through `scrollTop` would duplicate the topmost
        // visible line(s) into terminal history.
        const paddingTop = node.yogaNode?.getComputedPadding(Yoga.EDGE_TOP) ?? 0;
        const scrolledOff = Math.max(0, scrollTop - Math.round(paddingTop));
        const maxPushed = node.internal_maxPushedScrollTop ?? 0;
        const { maxScrollbackLength } = node.style;

        // Floor the slice start at scrolledOff - maxScrollbackLength so a large
        // jump in scrollTop emits at most maxScrollbackLength lines in one
        // frame (bounded burst). Unbounded when the cap is unset.
        const start = maxScrollbackLength === undefined ? maxPushed : Math.max(maxPushed, scrolledOff - Math.max(0, maxScrollbackLength));
        const count = scrolledOff - start;

        if (count <= 0) {
            return "";
        }

        const slice = composeBackbufferSlice(node, start, count);

        if (slice === "") {
            // Transient: not laid out / zero inner width this frame. Leave the
            // pointer unmoved so these rows are retried next frame instead of
            // being permanently skipped.
            return "";
        }

        node.internal_maxPushedScrollTop = scrolledOff;

        // Terminate each emitted block with an SGR reset so a colour/style
        // left open by the last slice line cannot bleed into the live frame.
        return `${slice}[0m\n`;
    }

    onRender: () => void = () => {
        this.hasPendingThrottledRender = false;

        if (this.isUnmounted) {
            return;
        }

        if (!this.deferredInitDone) {
            this.runDeferredInit();
        }

        if (this.nextRenderCommit) {
            this.nextRenderCommit.resolve();
            this.nextRenderCommit = undefined;
        }

        const renderStart = performance.now();
        const renderResult = render(this.rootNode, this.isScreenReaderEnabled, {
            useNativeRenderer: this.useNativeRenderer,
        });
        const renderTime = performance.now() - renderStart;

        this.commitFrame(renderResult);

        // Reported after the frame is written, so the callback can rely on what it observes on stdout.
        this.options.onRender?.({ renderTime });
    };

    private commitFrame(renderResult: ReturnType<typeof render>): void {
        const { cursorPosition, cursorRequested, cursorShape, output, outputBuffer, outputHeight, outputWidth, staticOutput } = renderResult;

        this.renderedCursorRequested = cursorRequested;
        this.renderedCursorPosition = cursorPosition;

        // Forward the declared cursor shape (or `undefined` when no <Cursor> is
        // mounted) every frame so log-update can diff and restore default on
        // unmount. log-update tracks emitted-vs-pending internally; passing
        // the same shape twice is a no-op.
        this.log.setCursorShape(cursorRequested ? cursorShape : undefined);

        // Lines that scrolled off the top of an `overflowToBackbuffer` region
        // this frame. Emitted once, above the live region, so they land in the
        // terminal's native scrollback. Never accumulated into fullStaticOutput
        // (they live in the terminal's own history; replay would duplicate).
        const backbufferOutput = this.computeBackbufferOutput();

        // Remembered on every path, so the exit path knows <Static> output was already written.
        if (staticOutput !== "") {
            this.staticOutputWritten = true;
        }

        // Native renderer path: write buffer directly via Rust diff engine
        if (this.useNativeRenderer && this.nativeLog && outputBuffer && outputWidth) {
            this.isFrameCleared = false;

            if (staticOutput) {
                this.fullStaticOutput += staticOutput;
            }

            const cursor = this.getActiveCursorPosition();

            this.nativeLog.setCursorShape(cursorRequested ? cursorShape : undefined);
            this.lastNativeFrame = { buffer: outputBuffer, cursor, height: outputHeight, width: outputWidth };

            if (this.alternateScreen) {
                // <Static> output and scrolled-off lines sit above the frame. The frame is drawn at absolute rows, so
                // when they change, or the screen was disturbed, the block is redrawn from home (as the string renderer
                // does on a full clear) and the frame starts below it. The prefix goes inside the frame's synchronized update.
                let prefix: string | undefined;

                if (staticOutput || backbufferOutput || this.nativeScreenStale) {
                    const { rows } = getWindowSize(this.options.stdout);
                    const above = tailLines(this.fullStaticOutput + backbufferOutput, rows - outputHeight);

                    this.nativeRowOffset = countLines(above);
                    this.nativeScreenStale = false;
                    prefix = clearScreenAndHomeCursor + above;
                }

                this.nativeLog.render(outputBuffer, outputWidth, outputHeight, { cursor, prefix, rowOffset: this.nativeRowOffset });
            } else {
                // Inline frames are anchored at the cursor, so nothing is redrawn from home. New <Static> output and
                // scrolled-off lines are written above the frame; the renderer erases the old frame first.
                this.nativeScreenStale = false;
                this.nativeLog.render(outputBuffer, outputWidth, outputHeight, { cursor, prefix: staticOutput + backbufferOutput });
            }

            this.lastOutputHeight = outputHeight;

            return;
        }

        // When a <Cursor> component is rendered, sync its position to log-update.
        // Only do this when cursorRequested is true to avoid marking cursor dirty
        // on every frame when no <Cursor> is mounted (which would cause render loops).
        if (cursorRequested) {
            this.log.setCursorPosition(this.getActiveCursorPosition());
        }

        // If <Static> output isn't empty, it means new children have been added to it
        const hasStaticOutput = staticOutput !== "";

        if (this.options.debug) {
            if (hasStaticOutput) {
                this.fullStaticOutput += staticOutput;
            }

            this.lastOutput = output;
            this.lastOutputToRender = output;
            this.lastOutputHeight = outputHeight;
            this.options.stdout.write(this.fullStaticOutput + output);

            return;
        }

        if (!this.interactive) {
            if (hasStaticOutput) {
                this.options.stdout.write(staticOutput);
            }

            this.lastOutput = output;
            this.lastOutputToRender = `${output}\n`;
            this.lastOutputHeight = outputHeight;

            return;
        }

        if (this.isScreenReaderEnabled) {
            const isSync = this.shouldSync();

            if (isSync) {
                this.options.stdout.write(bsu);
            }

            // Wrap before comparing so a terminal that changed width gets its output rewrapped.
            const terminalWidth = getWindowSize(this.options.stdout).columns;

            const wrappedOutput = wordWrap(output, {
                trim: false,
                width: terminalWidth,
                wrapMode: "BREAK_WORDS",
            }).replace(/\n$/, "");

            if (hasStaticOutput) {
                // We need to erase the main output before writing new static output
                const erase = this.lastOutputHeight > 0 ? eraseLines(this.lastOutputHeight) : "";

                this.options.stdout.write(erase + staticOutput);
                // After erasing, the last output is gone, so we should reset its height
                this.lastOutputHeight = 0;
            }

            if (wrappedOutput === this.lastOutputToRender && !hasStaticOutput) {
                if (isSync) {
                    this.options.stdout.write(esu);
                }

                return;
            }

            // If we haven't erased yet, do it now.
            if (hasStaticOutput) {
                this.options.stdout.write(wrappedOutput);
            } else {
                const erase = this.lastOutputHeight > 0 ? eraseLines(this.lastOutputHeight) : "";

                this.options.stdout.write(erase + wrappedOutput);
            }

            this.lastOutput = output;
            this.lastOutputToRender = wrappedOutput;
            this.lastOutputHeight = wrappedOutput === "" ? 0 : wrappedOutput.split("\n").length;

            // Keep log-update in step with the frame just written, so clear() and external-write
            // restoration can erase it. An empty frame has nothing on screen to track.
            if (wrappedOutput === "") {
                this.log.reset();
            } else {
                this.log.setCursorPosition(undefined);
                this.log.sync(wrappedOutput);
            }

            if (isSync) {
                this.options.stdout.write(esu);
            }

            return;
        }

        if (hasStaticOutput) {
            this.fullStaticOutput += staticOutput;
        }

        this.renderInteractiveFrame(output, outputHeight, hasStaticOutput ? staticOutput : "", backbufferOutput);
    }

    // Cache AccessibilityContext value to avoid creating a new object
    // on every render() call, which would force all consumers to re-render.
    private accessibilityContextValue: { isScreenReaderEnabled: boolean } | undefined;

    render(node: ReactNode): void {
        this.accessibilityContextValue ??= { isScreenReaderEnabled: this.isScreenReaderEnabled };

        const tree = (
            <AccessibilityContext.Provider value={this.accessibilityContextValue}>
                <App
                    exitOnCtrlC={this.options.exitOnCtrlC}
                    interactive={this.interactive}
                    onExit={this.handleAppExit}
                    onKittyQueryResponse={this.handleKittyQueryResponse}
                    onRegisterInputControl={this.registerInputControl}
                    onSuspendTerminal={this.suspendTerminal}
                    onWaitUntilRenderFlush={this.waitUntilRenderFlush}
                    renderThrottleMs={this.renderThrottleMs}
                    setCursorPosition={this.setCursorPosition}
                    stderr={this.options.stderr}
                    stdin={this.options.stdin}
                    stdout={this.options.stdout}
                    writeToStderr={this.writeToStderr}
                    writeToStdout={this.writeToStdout}
                >
                    {node}
                </App>
            </AccessibilityContext.Provider>
        );

        if (this.options.concurrent) {
            reconciler.updateContainer(tree, this.container, null, noop);
        } else {
            reconciler.updateContainerSync(tree, this.container, null, noop);
            reconciler.flushSyncWork();
        }

        // A commit with no host changes skips the layout hook, so a cleared frame would stay
        // hidden. Draw it again.
        if (this.isFrameCleared) {
            this.onRender();
        }
    }

    writeToStdout = (data: string): void => {
        if (this.isUnmounted) {
            return;
        }

        if (this.options.debug) {
            this.options.stdout.write(data + this.fullStaticOutput + this.lastOutput);

            return;
        }

        if (!this.interactive) {
            this.options.stdout.write(data);

            return;
        }

        const isSync = this.shouldSync();

        if (isSync) {
            this.options.stdout.write(bsu);
        }

        this.eraseFrame();
        this.options.stdout.write(data);
        this.restoreLastOutput();

        if (isSync) {
            this.options.stdout.write(esu);
        }
    };

    writeToStderr = (data: string): void => {
        if (this.isUnmounted) {
            return;
        }

        if (this.options.debug) {
            this.options.stderr.write(data);
            this.options.stdout.write(this.fullStaticOutput + this.lastOutput);

            return;
        }

        if (!this.interactive) {
            this.options.stderr.write(data);

            return;
        }

        const isSync = this.shouldSync();

        if (isSync) {
            this.options.stdout.write(bsu);
        }

        this.eraseFrame();
        this.options.stderr.write(data);
        this.restoreLastOutput();

        if (isSync) {
            this.options.stdout.write(esu);
        }
    };

    unmount = (error?: Error | number | null): void => {
        if (this.isUnmounted || this.isUnmounting) {
            return;
        }

        this.isUnmounting = true;

        if (this.beforeExitHandler) {
            process.off("beforeExit", this.beforeExitHandler);
            this.beforeExitHandler = undefined;
        }

        const stdout = this.options.stdout as MaybeWritableStream;
        const { canWriteToStdout, hasWritableState } = getWritableStreamState(stdout);

        // Clear any pending throttled render timer on unmount. When stdout is writable,
        // flush so the final frame is emitted; otherwise cancel to avoid delayed callbacks.
        settleThrottle(this.throttledOnRender, canWriteToStdout);

        if (
            canWriteToStdout // Skip the final render when in alternate screen mode — the alternate
            // buffer content is disposable and will be discarded when we switch back
            // to the primary screen. Rendering a final frame here would write content
            // to the alternate screen that is immediately discarded, or worse, if the
            // ALT_SCREEN_OFF write is buffered, the final frame could leak onto the
            // primary screen buffer.
            && !this.alternateScreen
        ) {
            const shouldRenderFinalFrame = (!this.throttledOnRender || (!this.hasPendingThrottledRender && !this.staticOutputWritten)) && !this.isFrameCleared;

            if (shouldRenderFinalFrame) {
                this.calculateLayout();
                this.onRender();
            }
        }

        // Mark as unmounted after the final render but before stdout writes
        // that could re-enter exit() via synchronous write callbacks.
        this.isUnmounted = true;

        this.unsubscribeExit();

        // Flush any pending throttled log writes if possible, otherwise cancel to
        // prevent delayed callbacks from writing to a closed stream.
        settleThrottle(this.throttledLog, canWriteToStdout);

        if (typeof this.restoreConsole === "function") {
            // Once unmount starts, Ink stops trying to manage teardown-time
            // console output. Restoring the native console before React cleanup keeps
            // unmount behavior simple and avoids special-case handling for custom
            // streams, fullscreen frames, and alternate-screen teardown.
            this.restoreConsole();
        }

        const finishUnmount = (): void => {
            if (typeof this.unsubscribeResize === "function") {
                this.unsubscribeResize();
            }

            // Cancel any in-progress auto-detection before checking protocol state
            this.finishKittyDetection?.(false);

            if (canWriteToStdout) {
                if (this.kittyProtocolEnabled) {
                    this.writeBestEffort(this.options.stdout, "\u{1B}[<u");
                    this.kittyProtocolEnabled = false;
                }

                // Alternate-screen content is disposable by design. We intentionally
                // leave it active until React cleanup finishes, then restore the
                // primary buffer without replaying prior frames, hook writes, or
                // diagnostics onto it. Trying to preserve teardown output across the
                // buffer switch adds fragile lifecycle-specific behavior, so Ink keeps
                // alternate-screen teardown intentionally simple and best-effort.
                if (this.alternateScreen) {
                    // Clear all log-update state BEFORE switching screens to prevent
                    // any buffered content from leaking onto the primary screen.
                    this.log.clear();
                    this.log.done();
                    this.nativeLog?.done();
                    this.lastOutput = "";
                    this.lastOutputToRender = "";
                    this.lastOutputHeight = 0;
                    this.fullStaticOutput = "";

                    // Switch back to the primary screen buffer
                    this.writeBestEffort(this.options.stdout, ALT_SCREEN_OFF);
                    this.writeBestEffort(this.options.stdout, cursorShow);
                    this.alternateScreen = false;
                } else if (!this.interactive) {
                    // Non-interactive environments don't handle erasing ansi escapes well.
                    // In debug mode, each render already writes to stdout, so only a trailing
                    // newline is needed. In non-debug mode, write the last frame now (it was
                    // deferred during rendering).
                    this.options.stdout.write(this.options.debug ? "\n" : `${this.lastOutput}\n`);
                } else if (!this.options.debug) {
                    this.nativeLog?.done();
                    this.log.done();
                }
            }

            this.kittyProtocolEnabled = false;

            instances.delete(this.options.stdout);

            // Children are freed by the reconciler; the root node is WASM memory the GC never reclaims.
            this.rootNode.yogaNode?.free();
            this.rootNode.yogaNode = undefined;

            // Ensure all queued writes have been processed before resolving the
            // exit promise. For real writable streams, queue an empty write as a
            // barrier — its callback fires only after all prior writes complete.
            // For non-stream objects (e.g. test spies), resolve on next tick.
            //
            // When called from signal-exit during process shutdown (error is a
            // number or null rather than undefined/Error), resolve synchronously
            // because the event loop is draining and async callbacks won't fire.
            const { exitResult } = this;

            const resolveOrReject = () => {
                if (isErrorInput(error)) {
                    this.rejectExitPromise(error);
                } else {
                    this.resolveExitPromise(exitResult);
                }
            };

            const isProcessExiting = error !== undefined && !isErrorInput(error);

            if (isProcessExiting) {
                resolveOrReject();
            } else if (canWriteToStdout && hasWritableState) {
                this.options.stdout.write("", resolveOrReject);
            } else {
                setImmediate(resolveOrReject);
            }
        };

        const concurrentReconciler = reconciler as {
            flushPassiveEffects?: () => boolean;
        };

        if (this.options.concurrent) {
            reconciler.updateContainerSync(null, this.container, null, noop);
            reconciler.flushSyncWork();
            concurrentReconciler.flushPassiveEffects?.();
            finishUnmount();
        } else {
            // Legacy mode: use updateContainerSync + flushSyncWork (sync)
            reconciler.updateContainerSync(null, this.container, null, noop);
            reconciler.flushSyncWork();
            finishUnmount();
        }
    };

    async waitUntilExit(): Promise<unknown> {
        // Register a beforeExit handler to auto-unmount when the event loop
        // drains (no pending work). This is safe for both interactive and
        // non-interactive modes: when raw mode is active (interactive apps
        // reading input), stdin.ref() keeps the event loop alive so beforeExit
        // won't fire. When no raw mode is active (e.g. a static render in a
        // PTY), the event loop drains naturally and beforeExit triggers a
        // clean unmount.
        // After (or during) unmount nothing would ever remove the listener again.
        if (!this.beforeExitHandler && !this.isUnmounted && !this.isUnmounting) {
            this.beforeExitHandler = () => {
                this.unmount();
            };

            process.on("beforeExit", this.beforeExitHandler);
        }

        return this.exitPromise;
    }

    async waitUntilRenderFlush(): Promise<void> {
        if (this.isUnmounted || this.isUnmounting) {
            await this.awaitExit();

            return;
        }

        // Yield to the macrotask queue so that React's scheduler has a chance to
        // fire passive effects and process any work they enqueued.
        await yieldImmediate();

        if (this.isUnmounted || this.isUnmounting) {
            await this.awaitExit();

            return;
        }

        // In concurrent mode, React's scheduler may still be mid-render after
        // the yield. Wait for the next render commit instead of polling.
        if (this.isConcurrent && this.hasPendingConcurrentWork()) {
            await Promise.race([this.awaitNextRender(), this.awaitExit()]);

            if (this.isUnmounted || this.isUnmounting) {
                this.nextRenderCommit = undefined;
                await this.awaitExit();

                return;
            }
        }

        reconciler.flushSyncWork();

        const stdout = this.options.stdout as MaybeWritableStream;
        const { canWriteToStdout, hasWritableState } = getWritableStreamState(stdout);

        // Flush pending throttled render/log timers so their output is included in this wait.
        settleThrottle(this.throttledOnRender, canWriteToStdout);
        settleThrottle(this.throttledLog, canWriteToStdout);

        if (canWriteToStdout && hasWritableState) {
            await new Promise<void>((resolve) => {
                this.options.stdout.write("", () => {
                    resolve();
                });
            });

            return;
        }

        await yieldImmediate();
    }

    // Erases the frame before output is written above it. Inline native frames are erased here too; the alternate-screen
    // frame is redrawn from home instead, so it is left alone.
    private eraseFrame(): void {
        this.log.clear();

        if (!this.alternateScreen) {
            this.nativeLog?.clear();
        }
    }

    clear(): void {
        if (!this.interactive || this.options.debug) {
            return;
        }

        this.log.clear();
        this.nativeLog?.clear();
        this.isFrameCleared = true;
    }

    patchConsole(): void {
        if (this.options.debug) {
            return;
        }

        this.restoreConsole = patchConsole((stream, data) => {
            if (stream === "stdout") {
                this.writeToStdout(data);
            }

            if (stream === "stderr") {
                const isReactMessage = data.startsWith("The above error occurred");

                if (!isReactMessage) {
                    this.writeToStderr(data);
                }
            }
        });
    }

    private setAlternateScreen(enabled: boolean): void {
        this.alternateScreen = this.resolveAlternateScreenOption(enabled, this.interactive);

        if (this.alternateScreen) {
            this.writeBestEffort(this.options.stdout, ALT_SCREEN_ON);
            this.writeBestEffort(this.options.stdout, cursorHide);
        }
    }

    private resolveInteractiveOption(interactive: boolean | undefined): boolean {
        return interactive ?? (!isInCi && this.options.stdout.isTTY);
    }

    private resolveAlternateScreenOption(alternateScreen: boolean | undefined, interactive: boolean): boolean {
        return Boolean(alternateScreen) && interactive && this.options.stdout.isTTY;
    }

    private shouldSync(): boolean {
        return shouldSynchronize(this.options.stdout, this.interactive);
    }

    // Best-effort write: streams may already be destroyed during shutdown.
    private writeBestEffort(stream: NodeJS.WriteStream, data: string): void {
        try {
            stream.write(data);
        } catch {}
    }

    // Waits for the exit promise to settle, suppressing any rejection.
    // Errors are surfaced via waitUntilExit() instead.
    private async awaitExit(): Promise<void> {
        try {
            await this.exitPromise;
        } catch {}
    }

    private hasPendingConcurrentWork(): boolean {
        const concurrentContainer = this.container as {
            callbackNode?: unknown;
            pendingLanes?: number;
        };

        return (concurrentContainer.pendingLanes ?? 0) !== 0 && concurrentContainer.callbackNode !== undefined && concurrentContainer.callbackNode !== null;
    }

    private async awaitNextRender(): Promise<void> {
        if (!this.nextRenderCommit) {
            let resolveRender!: () => void;
            const promise = new Promise<void>((resolve) => {
                resolveRender = resolve;
            });

            this.nextRenderCommit = { promise, resolve: resolveRender };
        }

        return this.nextRenderCommit.promise;
    }

    private renderInteractiveFrame(output: string, outputHeight: number, staticOutput: string, backbufferOutput = ""): void {
        const { isFrameCleared } = this;

        this.isFrameCleared = false;

        // Both <Static> output and scrolled-off backbuffer lines ride the same
        // "above the live region" channel. backbufferOutput is intentionally
        // NOT accumulated into this.fullStaticOutput by the caller: those lines
        // already live in the terminal's own scrollback, so replaying them on a
        // clear/redraw would duplicate (potentially huge) history.
        const prepend = staticOutput + backbufferOutput;
        const hasPrepend = prepend !== "";
        const isTty = this.options.stdout.isTTY;

        // Detect fullscreen: output fills or exceeds terminal height.
        // Only apply when writing to a real TTY — piped output always gets trailing newlines.
        const viewportRows = isTty ? getWindowSize(this.options.stdout).rows : 24;
        const isFullscreen = isTty && outputHeight >= viewportRows;
        const outputToRender = isFullscreen ? output : `${output}\n`;

        // Read process.platform at call time so the Windows fullscreen-clear path
        // stays toggleable from tests (and matches the actual runtime platform).
        const isWindows = process.platform === "win32";
        // On Windows, fullscreen incremental redraws are broken (immediate scroll
        // drifts the cursor arithmetic), so the clear cannot be skipped even in
        // incremental mode. See vadimdemedes/ink#971.
        const isWindowsFullscreenRedraw = isTty && isWindows && (isFullscreen || this.lastOutputHeight >= viewportRows);

        const shouldClearTerminal = shouldClearTerminalForFrame({
            isTty,
            isUnmounting: this.isUnmounting,
            isWindows,
            nextOutputHeight: outputHeight,
            previousOutputHeight: this.lastOutputHeight,
            viewportRows,
        });

        if (shouldClearTerminal) {
            // Skip clearTerminal in incremental mode to avoid erase-then-redraw flicker.
            // Instead, fall through to the normal incremental update path below so that
            // static output is still handled and the log-update diffing takes care of it.
            // Exception: Windows fullscreen redraws must perform a real clear because
            // the incremental eraseLines path is broken there (see ink#971).
            if (this.options.incrementalRendering && !isWindowsFullscreenRedraw) {
                if (hasPrepend) {
                    this.log.clear();
                    this.options.stdout.write(prepend);
                }

                if (output !== this.lastOutput || this.log.isCursorDirty() || hasPrepend) {
                    this.throttledLog(outputToRender);
                }

                this.lastOutput = output;
                this.lastOutputToRender = outputToRender;
                this.lastOutputHeight = outputHeight;

                return;
            }

            // A throttled trailing render can arrive with the frame already on screen. Clearing again would push
            // that copy into scrollback, so skip it unless something changed. The final frame on unmount is still drawn.
            if (output === this.lastOutput && !hasPrepend && !isFrameCleared && !this.log.isCursorDirty() && !this.isUnmounting) {
                return;
            }

            const isSync = this.shouldSync();

            if (isSync) {
                this.options.stdout.write(bsu);
            }

            // Use a viewport-only clear (CSI H + CSI 2J) instead of resetTerminal
            // (which includes CSI 3J + RIS). Emitting CSI 3J during a rerender wipes
            // the terminal scrollback buffer in VT-compliant terminals (tmux, xterm.js,
            // Microsoft Terminal, WezTerm, Alacritty, Kitty, Ghostty, etc.), destroying
            // the user's history. See vadimdemedes/ink#935 and the upstream fix in
            // vadimdemedes/ink#936.
            // backbufferOutput sits above the live output for this frame only;
            // it is deliberately excluded from this.fullStaticOutput so it is
            // not replayed (and duplicated) on subsequent clear/redraw cycles.
            // Write `outputToRender`, not `output`: log.sync() below derives its
            // line count from `outputToRender`, so emitting the un-terminated
            // `output` here would leave the log believing the live region is one
            // row taller than it is, and the next clear() would erase the bottom
            // line of the static block above it. See vadimdemedes/ink#974.
            // <Static> output the previous frame already pushed off-screen is not replayed: it lives in the
            // terminal's scrollback, and replaying it on every full clear would stack another copy there.
            // When the previous live region did not fill the viewport, the static block is still on screen
            // and the clear would erase it, so the whole static history is written again. Static output new
            // in this frame has not been written anywhere yet, so it is always written.
            const isStaticOnScreen = this.lastOutputHeight < viewportRows;
            const staticToWrite = isStaticOnScreen ? this.fullStaticOutput : staticOutput;

            this.options.stdout.write(clearScreenAndHomeCursor + staticToWrite + backbufferOutput + outputToRender);
            this.lastOutput = output;
            this.lastOutputToRender = outputToRender;
            this.lastOutputHeight = outputHeight;
            this.log.sync(outputToRender);

            if (isSync) {
                this.options.stdout.write(esu);
            }

            return;
        }

        // To ensure prepended output (static + backbuffer) is cleanly rendered
        // before main output, clear main output first
        if (hasPrepend) {
            const isSync = this.shouldSync();

            if (isSync) {
                this.options.stdout.write(bsu);
            }

            this.log.clear();
            this.options.stdout.write(prepend);
            this.log(outputToRender);

            if (isSync) {
                this.options.stdout.write(esu);
            }
        } else if (output !== this.lastOutput || this.log.isCursorDirty() || isFrameCleared) {
            // ThrottledLog manages its own bsu/esu at actual write time
            this.throttledLog(outputToRender);
        }

        this.lastOutput = output;
        this.lastOutputToRender = outputToRender;
        this.lastOutputHeight = outputHeight;
    }

    /**
     * Handle kitty keyboard "enabled" mode immediately (just a stdout.write).
     * Called from the constructor.
     */
    private initImmediateKittyKeyboard(): void {
        if (!this.options.kittyKeyboard) {
            return;
        }

        const options = this.options.kittyKeyboard;
        const mode = options.mode ?? "auto";

        if (mode !== "enabled") {
            return;
        }

        const flags: KittyFlagName[] = options.flags ?? ["disambiguateEscapeCodes"];

        // 'enabled' force-enables the protocol as long as both streams are TTYs,
        // regardless of the interactive setting (e.g. even in CI).
        if (this.options.stdin.isTTY && this.options.stdout.isTTY) {
            this.enableKittyProtocol(flags);
        }
    }

    /**
     * Handle kitty keyboard "auto" mode detection. Deferred to first render
     * because the CSI ? u query sets up a stdin listener with a 200ms timeout.
     */
    private initDeferredKittyKeyboard(): void {
        if (!this.options.kittyKeyboard) {
            return;
        }

        const options = this.options.kittyKeyboard;
        const mode = options.mode ?? "auto";

        if (mode !== "auto") {
            return;
        }

        const flags: KittyFlagName[] = options.flags ?? ["disambiguateEscapeCodes"];

        // Auto mode: require interactive + TTY
        if (!this.interactive || !this.options.stdin.isTTY || !this.options.stdout.isTTY) {
            return;
        }

        // Auto mode: query the terminal for kitty keyboard protocol support.
        // The CSI ? u query is safe to send to any terminal — unsupporting
        // terminals simply won't respond, and the 200ms timeout handles that.
        this.confirmKittySupport(flags);
    }

    private confirmKittySupport(flags: KittyFlagName[]): void {
        // Serialized against the OSC palette query, which reads the same stdin. Concurrent probes
        // mistake each other's answers for user input: this one's stripper does not know about OSC
        // replies, so it would unshift the palette's answer into the input pipeline.
        void runExclusiveProbe(this.options.stdin, async () => this.runKittySupportQuery(flags));
    }

    private async runKittySupportQuery(flags: KittyFlagName[]): Promise<void> {
        const { stdout } = this.options;

        // The reply reaches us through App's input pipeline (see onKittyQueryResponse), so it is never read twice.
        // Resolves when the reply arrives, when the window closes, or when suspension cancels the probe.
        return new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                finish(false);
            }, 200);

            const finish = (supported: boolean): void => {
                clearTimeout(timer);
                this.finishKittyDetection = undefined;

                if (supported && !this.isUnmounted) {
                    this.enableKittyProtocol(flags);
                }

                resolve();
            };

            // Register before writing the query so an immediate reply is not missed.
            this.finishKittyDetection = finish;
            stdout.write("\u001B[?u");
        });
    }

    // Must stay referentially stable across `render()` calls: it feeds into App's
    // `setRawMode` identity, so a new function per `rerender()` would make every
    // `useInput`/`usePaste` re-run its raw-mode effect and reset the input parser,
    // dropping keys and pastes that were still in flight.
    handleKittyQueryResponse = (): void => {
        this.finishKittyDetection?.(true);
    };

    // Called by the App component to register how input is paused/resumed. Kept
    // as an arrow field so it can be passed as a prop without binding.
    registerInputControl = (pauseInput: () => void, resumeInput: () => void): void => {
        this.pauseInput = pauseInput;
        this.resumeInput = resumeInput;
    };

    /**
     * Hand terminal control to a child process, then restore Ink's rendering.
     * With a callback, the terminal is released for its duration and resumed in a
     * `finally`. Without one, returns a handle whose `resume()` (or `await using`)
     * restores.
     */
    suspendTerminal = (async (callback?: () => Promise<void> | void): Promise<TerminalSuspension | undefined> => {
        const suspension = this.beginSuspend();

        if (callback) {
            try {
                await callback();
            } finally {
                await this.endSuspend(suspension);
            }

            return undefined;
        }

        const resume = async (): Promise<void> => {
            await this.endSuspend(suspension);
        };

        return { resume, [Symbol.asyncDispose]: resume };
    }) as {
        (callback: () => Promise<void> | void): Promise<undefined>;
        (): Promise<TerminalSuspension>;
    };

    private beginSuspend(): object {
        if (this.activeSuspension) {
            throw new Error("The terminal is already suspended. Resume the current suspension before suspending again.");
        }

        // Identifies this suspension, so a handle from an earlier one cannot resume a later one.
        const suspension = {};

        this.activeSuspension = suspension;

        // A reply that arrives while the child owns the terminal must not enable the protocol.
        this.finishKittyDetection?.(false);

        if (!this.interactive || this.isUnmounted || this.isUnmounting) {
            return suspension;
        }

        try {
            // Erase Ink's current frame so the child starts from a settled screen.
            this.log.clear();
            this.log.done();
            this.nativeLog?.done();

            if (this.kittyProtocolEnabled) {
                this.writeBestEffort(this.options.stdout, "[<u");
                this.kittyProtocolEnabled = false;
            }

            if (this.alternateScreen) {
                this.writeBestEffort(this.options.stdout, ALT_SCREEN_OFF);
                this.writeBestEffort(this.options.stdout, cursorShow);
            }

            // Hand input back to the terminal (raw mode off, bracketed paste off).
            this.pauseInput?.();
        } catch (error) {
            // If handing over the terminal fails partway, don't strand the app
            // suspended with no way back: reclaim input, clear the flag, rethrow.
            this.activeSuspension = undefined;

            try {
                this.resumeInput?.();
            } catch {
                // best effort
            }

            throw error;
        }

        return suspension;
    }

    private async endSuspend(suspension: object): Promise<void> {
        // Already resumed, or superseded by a later suspension.
        if (this.activeSuspension !== suspension) {
            return;
        }

        this.activeSuspension = undefined;

        if (!this.interactive || this.isUnmounted || this.isUnmounting) {
            return;
        }

        // Reclaim input only while the app still owns the terminal. After unmount, App cleanup has already released it.
        this.resumeInput?.();

        if (this.alternateScreen) {
            this.writeBestEffort(this.options.stdout, ALT_SCREEN_ON);

            // The alternate screen comes back blank, so <Static> output that was written before the
            // suspend has to be drawn again. The native frame writes it from home on its next commit instead.
            if (this.fullStaticOutput !== "" && !this.useNativeRenderer) {
                this.writeBestEffort(this.options.stdout, this.fullStaticOutput);
            }
        }

        if (this.kittyFlags) {
            this.writeBestEffort(this.options.stdout, `\u{1B}[>${resolveFlags(this.kittyFlags)}u`);
            this.kittyProtocolEnabled = true;
        }

        // Force a full redraw instead of diffing against the stale pre-suspension
        // frame, which the child process may have overwritten.
        this.lastOutput = "";
        this.lastOutputToRender = "";
        this.lastOutputHeight = 0;
        this.log.reset();
        // Whatever the child left on screen is not ours to erase, so the frame is forgotten and drawn again at the cursor.
        this.nativeLog?.destroy();
        this.nativeScreenStale = true;

        try {
            this.calculateLayout();
            this.onRender();
            await this.waitUntilRenderFlush();
        } catch {
            // best effort — must not mask a callback error in the caller's finally
        }
    }

    private enableKittyProtocol(flags: KittyFlagName[]): void {
        this.kittyFlags = flags;
        this.options.stdout.write(`\u{1B}[>${resolveFlags(flags)}u`);
        this.kittyProtocolEnabled = true;
    }
}
