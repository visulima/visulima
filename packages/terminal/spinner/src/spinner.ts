/* eslint-disable max-classes-per-file */

import { styleText } from "node:util";

import type { InteractiveManager } from "@visulima/interactive-manager";

import { getSpinner, getSpinnerNames } from "./spinners";
import type { SpinnerFrame, SpinnerIcons, SpinnerName, SpinnerOptions, SpinnerStartOptions, SpinnerStyle } from "./types";

/**
 * Default icons for spinner completion states.
 */
const DEFAULT_ICONS: Required<SpinnerIcons> = {
    error: "✖",
    info: "ℹ",
    success: "✓",
    warning: "⚠",
};

/**
 * Detect whether the current environment looks like a non-interactive CI runner.
 *
 * Mirrors ora's behaviour: animation is suppressed so CI logs aren't spammed with
 * one line per frame. Detection is intentionally cheap and dependency-free.
 */
const isCi = (): boolean => {
    const { env } = process;

    return Boolean(env.CI) || env.CONTINUOUS_INTEGRATION === "true" || "BUILD_NUMBER" in env || "RUN_ID" in env;
};

const ANSI_ESCAPE_RE = /\u001B\[[\d;]*[A-Za-z]/g;

/**
 * Approximate the printable width of a line, ignoring ANSI escape sequences.
 *
 * Used to estimate how many physical terminal rows a standalone line wraps onto so
 * the previous frame can be fully erased. Counts code points rather than UTF-16 units
 * so astral glyphs (e.g. emoji frames) don't over-count.
 */
const visibleWidth = (text: string): number => [...text.replace(ANSI_ESCAPE_RE, "")].length;

/**
 * Resolve a SpinnerStyle object into Node.js `util.styleText` format strings.
 */

// eslint-disable-next-line @stylistic/no-extra-parens
const resolveStyleToFunction = (style: SpinnerStyle): ((text: string) => string) => {
    const formats: string[] = [];

    if (style.bold) {
        formats.push("bold");
    }

    if (style.dim) {
        formats.push("dim");
    }

    if (style.italic) {
        formats.push("italic");
    }

    if (style.underline) {
        formats.push("underline");
    }

    if (style.strikethrough) {
        formats.push("strikethrough");
    }

    if (style.color) {
        formats.push(style.color);
    }

    if (style.bgColor) {
        formats.push(style.bgColor);
    }

    if (formats.length === 0) {
        return (text: string) => text;
    }

    return (text: string) => styleText(formats as Parameters<typeof styleText>[0], text);
};

/**
 * Spinner class for creating loading indicators in terminal applications.
 *
 * Works standalone with direct stream output (defaults to `process.stderr`), or with
 * an `InteractiveManager` for coordinated terminal output (e.g., alongside progress
 * bars or logs).
 *
 * Animation is automatically disabled when the target stream is not a TTY or when a
 * CI environment is detected — the final status line is still printed, but no
 * per-frame redraws happen. Pass `verbose: false` to silence output entirely.
 * @example
 * ```typescript
 * // Zero-config — writes directly to process.stderr
 * const spinner = new Spinner({ name: "dots" });
 * spinner.start("Loading...");
 * spinner.succeed("Done!");
 *
 * // With declarative style (uses Node.js util.styleText)
 * const spinner = new Spinner({
 *   name: "dots",
 *   style: { bold: true, color: "blue" },
 * });
 *
 * // With function style (full control, e.g. using colorize)
 * const spinner = new Spinner({
 *   name: "dots",
 *   style: (text) => colorize.bold.blue(text),
 * });
 *
 * // With a custom frame set
 * const spinner = new Spinner({ frames: { frames: ["-", "\\", "|", "/"], interval: 80 } });
 * ```
 */

export class Spinner {
    #frame: number = 0;

    #frameInterval: ReturnType<typeof setInterval> | undefined;

    #isActive: boolean = false;

    #prefixText: string = "";

    #text: string = "";

    #startTime: number = 0;

    #endTime: number = 0;

    #interactiveManager?: InteractiveManager;

    #multiSpinner?: MultiSpinner;

    #finalOutput: string = "";

    /** Resolved frame set, cached so the catalog isn't re-looked-up per frame. */
    readonly #spinner: SpinnerFrame;

    readonly #verbose: boolean;

    readonly #stream: NodeJS.WriteStream;

    /** Whether the spinner may animate (TTY + not CI + not standalone). */
    readonly #animate: boolean;

    /** Number of lines the standalone direct render last wrote (for in-place clear). */
    #standaloneLines: number = 0;

    readonly #applyStyle?: (text: string) => string;

    readonly #icons: Required<SpinnerIcons>;

    /**
     * Creates a new Spinner instance.
     * @param options Configuration options for the spinner
     * @param interactiveManager Optional interactive manager for terminal control
     * @throws {Error} If `options.name` is not a known spinner and no custom `frames` are supplied.
     */
    public constructor(options: SpinnerOptions = {}, interactiveManager?: InteractiveManager) {
        if (options.frames) {
            this.#spinner = options.frames;
        } else {
            const name: SpinnerName = options.name ?? "dots";
            const resolved = getSpinner(name);

            if (!resolved) {
                throw new Error(`Unknown spinner "${name}". Pass a custom \`frames\` set or use one of: ${getSpinnerNames().join(", ")}.`);
            }

            this.#spinner = resolved;
        }

        this.#verbose = options.verbose !== false;
        this.#prefixText = options.prefixText ?? "";

        this.#interactiveManager = interactiveManager;
        this.#stream = options.stream ?? process.stderr;
        // With a manager the manager owns the surface; standalone only animates on a
        // real TTY outside CI so non-interactive logs aren't spammed one line per frame.
        this.#animate = interactiveManager ? true : this.#stream.isTTY && !isCi();
        this.#icons = { ...DEFAULT_ICONS, ...options.icons };

        // Resolve style: function stays as-is, object gets converted via util.styleText
        if (typeof options.style === "function") {
            this.#applyStyle = options.style;
        } else if (options.style) {
            this.#applyStyle = resolveStyleToFunction(options.style);
        }
    }

    /**
     * Current elapsed time in milliseconds.
     */
    public get elapsedTime(): number {
        if (this.#startTime === 0) {
            return 0;
        }

        return (this.#endTime || Date.now()) - this.#startTime;
    }

    /**
     * Get or set the spinner text.
     */
    public get text(): string {
        return this.#text;
    }

    public set text(value: string) {
        this.#text = value;

        if (this.#isActive) {
            this.#requestRender();
        }
    }

    /**
     * Get or set the prefix text.
     */
    public get prefixText(): string {
        return this.#prefixText;
    }

    public set prefixText(value: string) {
        this.#prefixText = value;

        if (this.#isActive) {
            this.#requestRender();
        }
    }

    /**
     * Whether the spinner is currently active.
     */
    public get isRunning(): boolean {
        return this.#isActive;
    }

    /**
     * Set the interactive manager for interactive mode.
     * @internal
     */
    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    /**
     * Set the multi spinner reference.
     * @internal
     */
    public setMultiSpinner(multiSpinner?: MultiSpinner): void {
        this.#multiSpinner = multiSpinner;
    }

    /**
     * Advance the spinner to the next frame and redraw. Owned by `MultiSpinner` so a
     * single shared timer can drive all children.
     * @internal
     */
    public tick(): void {
        if (!this.#isActive) {
            return;
        }

        this.#frame = (this.#frame + 1) % this.#spinner.frames.length;
    }

    /**
     * Start the spinner with optional text.
     * @param text Optional text to display
     * @param options Optional start options
     * @returns The spinner instance for chaining
     */
    public start(text?: string, options?: SpinnerStartOptions): this {
        if (this.#isActive) {
            return this;
        }

        if (!this.#verbose) {
            return this;
        }

        this.#isActive = true;
        this.#startTime = Date.now();
        this.#endTime = 0;
        this.#frame = 0;
        this.#finalOutput = "";

        if (text) {
            this.#text = text;
        }

        if (options?.prefixText) {
            this.#prefixText = options.prefixText;
        }

        if (this.#multiSpinner) {
            // The MultiSpinner owns the shared render timer; just trigger a redraw.
            this.#multiSpinner.renderAll();

            return this;
        }

        if (this.#interactiveManager) {
            this.#interactiveManager.hook();
            this.#render();
            this.#startTimer();
        } else {
            // Standalone direct-stream mode.
            this.#renderStandalone();
            this.#startTimer();
        }

        return this;
    }

    /**
     * Stop the spinner without printing a status icon and clear its line.
     *
     * Useful before showing a prompt or other output. Mirrors ora's `stop()`.
     */
    public stop(): void {
        if (!this.#isActive) {
            return;
        }

        this.#clearTimer();
        this.#isActive = false;
        this.#endTime = Date.now();
        this.#finalOutput = "";

        if (this.#multiSpinner) {
            this.#multiSpinner.renderAll();

            return;
        }

        if (this.#interactiveManager) {
            this.#interactiveManager.erase("stdout");
            this.#interactiveManager.unhook(false);
        } else {
            this.#eraseStandalone();
        }
    }

    /**
     * Stop the spinner and persist a custom line (no status icon unless provided).
     *
     * Mirrors ora's `stopAndPersist`. When `symbol` is omitted, the current text is
     * persisted as-is.
     * @param options Optional overrides for the persisted line.
     * @param options.prefixText Prefix shown before the symbol (defaults to the current prefix).
     * @param options.symbol Leading symbol/glyph (defaults to none).
     * @param options.text Text shown after the symbol (defaults to the current text).
     */
    public stopAndPersist(options?: { prefixText?: string; symbol?: string; text?: string }): void {
        if (!this.#isActive) {
            return;
        }

        this.#clearTimer();
        this.#isActive = false;
        this.#endTime = Date.now();

        if (!this.#verbose) {
            return;
        }

        const prefix = options?.prefixText ?? this.#prefixText;
        const text = options?.text ?? this.#text;

        let output = options?.symbol ?? "";

        if (prefix) {
            output = output ? `${prefix} ${output}` : prefix;
        }

        if (text) {
            output = output ? `${output} ${text}` : text;
        }

        this.#persist(output);
    }

    /**
     * Stop the spinner with a success message.
     * @param text Optional success text
     */
    public succeed(text?: string): void {
        this.#stop("success", text);
    }

    /**
     * Stop the spinner with a failure message.
     * @param text Optional failure text
     */
    public failed(text?: string): void {
        this.#stop("error", text);
    }

    /**
     * Stop the spinner with a warning message.
     * @param text Optional warning text
     */
    public warn(text?: string): void {
        this.#stop("warning", text);
    }

    /**
     * Stop the spinner with an info message.
     * @param text Optional info text
     */
    public info(text?: string): void {
        this.#stop("info", text);
    }

    /**
     * Pause the spinner without stopping it.
     */
    public pause(): void {
        this.#clearTimer();
    }

    /**
     * Resume the spinner if it was paused.
     */
    public resume(): void {
        if (!this.#isActive) {
            return;
        }

        this.#clearTimer();

        // MultiSpinner children are driven by the shared timer, never their own.
        if (!this.#multiSpinner) {
            this.#startTimer();
        }
    }

    /**
     * Get current frame output.
     * @internal
     */
    public getFrameOutput(): string {
        if (!this.#isActive && this.#finalOutput) {
            return this.#finalOutput;
        }

        const frame = this.#spinner.frames[this.#frame] as string;

        let output = this.#applyStyle ? this.#applyStyle(frame) : frame;

        if (this.#prefixText) {
            output = `${this.#prefixText} ${output}`;
        }

        if (this.#text) {
            output = `${output} ${this.#text}`;
        }

        return output;
    }

    /**
     * Start the per-frame animation timer for standalone / single-manager mode.
     * The interval is `.unref()`'d so a forgotten spinner never holds the event loop open.
     */
    #startTimer(): void {
        if (!this.#animate) {
            return;
        }

        this.#frameInterval = setInterval(() => {
            if (!this.#isActive) {
                return;
            }

            this.#frame = (this.#frame + 1) % this.#spinner.frames.length;

            this.#requestRender();
        }, this.#spinner.interval);

        // Don't keep the process alive solely for the animation timer.
        this.#frameInterval.unref();
    }

    #clearTimer(): void {
        if (this.#frameInterval) {
            clearInterval(this.#frameInterval);
            this.#frameInterval = undefined;
        }
    }

    /** Redraw the spinner via whichever render path is active. */
    #requestRender(): void {
        if (this.#multiSpinner) {
            this.#multiSpinner.renderAll();
        } else if (this.#interactiveManager) {
            this.#render();
        } else {
            this.#renderStandalone();
        }
    }

    #render(): void {
        if (this.#interactiveManager) {
            this.#interactiveManager.update("stdout", [this.getFrameOutput()]);
        }
    }

    /** Direct-stream render for standalone mode (no InteractiveManager). */
    #renderStandalone(): void {
        const output = this.getFrameOutput();

        this.#eraseStandalone();

        if (this.#stream.isTTY) {
            this.#stream.write(output);
            // Track how many physical rows the line occupies so a wrapped line is
            // fully erased on the next redraw instead of leaving scrolled garbage.
            const columns = this.#stream.columns || 80;

            this.#standaloneLines = Math.max(1, Math.ceil(visibleWidth(output) / columns));
        } else {
            // Non-TTY: print the line once so it lands in logs without cursor tricks.
            this.#stream.write(`${output}\n`);
            this.#standaloneLines = 0;
        }
    }

    /** Erase the previously written standalone line(s) in-place on a TTY. */
    #eraseStandalone(): void {
        if (this.#standaloneLines > 0 && this.#stream.isTTY) {
            // Clear each wrapped physical row, walking the cursor up, then
            // carriage-return + clear-to-end-of-line for the first row.
            for (let index = 1; index < this.#standaloneLines; index++) {
                this.#stream.write("\u001B[1A\u001B[2K");
            }

            // Carriage return + clear-to-end-of-line.
            this.#stream.write("\r\u001B[K");
        }

        this.#standaloneLines = 0;
    }

    /** Persist a final line and tear down whichever render path is active. */
    #persist(output: string): void {
        this.#finalOutput = output;

        if (this.#multiSpinner) {
            this.#multiSpinner.renderAll();
        } else if (this.#interactiveManager) {
            this.#interactiveManager.update("stdout", [output]);
            this.#interactiveManager.unhook(false);
        } else {
            this.#eraseStandalone();
            this.#stream.write(`${output}\n`);
        }
    }

    #stop(status: "error" | "info" | "success" | "warning", text?: string): void {
        if (!this.#isActive) {
            return;
        }

        this.#clearTimer();

        this.#isActive = false;
        this.#endTime = Date.now();

        if (!this.#verbose) {
            return;
        }

        let output = "";

        const icon = this.#icons[status];

        if (icon) {
            output = this.#applyStyle ? this.#applyStyle(icon) : icon;
        }

        if (this.#prefixText) {
            output = `${this.#prefixText} ${output}`;
        }

        if (text) {
            output = `${output} ${text}`;
        }

        this.#persist(output);
    }
}

/**
 * Multi-Spinner class for managing multiple spinners concurrently.
 *
 * A single shared timer (owned by the MultiSpinner) drives every child, so rendering
 * is O(N) per tick rather than N uncoordinated timers each redrawing all N lines.
 * @example
 * ```typescript
 * const multiSpinner = new MultiSpinner({ name: "dots" }, interactiveManager);
 * const spinner1 = multiSpinner.create("Task 1");
 * const spinner2 = multiSpinner.create("Task 2");
 * spinner1.start();
 * spinner2.start();
 * spinner1.succeed();
 * spinner2.failed();
 * multiSpinner.stop();
 * ```
 */
export class MultiSpinner {
    #spinners = new Map<string, Spinner>();

    #nextSpinnerId: number = 0;

    #interactiveManager?: InteractiveManager;

    #isActive: boolean = false;

    #sharedTimer: ReturnType<typeof setInterval> | undefined;

    readonly #options: SpinnerOptions;

    /** Shared tick interval in ms, derived from the configured frame set. */
    readonly #interval: number;

    public constructor(options: SpinnerOptions = {}, interactiveManager?: InteractiveManager) {
        this.#options = options;
        this.#interactiveManager = interactiveManager;

        // Resolve the interval once from the shared frame configuration.
        this.#interval = options.frames ? options.frames.interval : getSpinner(options.name ?? "dots")?.interval ?? 80;
    }

    /** @internal */
    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    public create(text?: string, options: SpinnerOptions = {}): Spinner {
        // eslint-disable-next-line no-plusplus
        const id = `spinner_${String(this.#nextSpinnerId++)}`;

        const spinner = new Spinner({ ...this.#options, ...options });

        spinner.setMultiSpinner(this);
        this.#spinners.set(id, spinner);

        if (text) {
            spinner.text = text;
        }

        return spinner;
    }

    public remove(spinner: Spinner): boolean {
        for (const [id, s] of this.#spinners.entries()) {
            if (s === spinner) {
                this.#spinners.delete(id);

                if (this.#spinners.size === 0) {
                    // The stack is now empty: erase the removed line and unhook instead
                    // of leaving its last frame on screen with the manager still hooked.
                    this.#clearSharedTimer();

                    if (this.#interactiveManager && this.#isActive) {
                        this.#interactiveManager.erase("stdout");
                        this.#interactiveManager.unhook(false);
                    }

                    this.#isActive = false;
                } else {
                    this.renderAll();
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Stop the group: tear down the shared timer and the manager hook, leaving each
     * child's last rendered state intact (already-finished spinners keep their status).
     *
     * Unlike a force-`succeed()`, this does NOT mark in-progress or failed tasks as
     * successful.
     */
    public stop(): void {
        this.#clearSharedTimer();

        this.#spinners.clear();
        this.#isActive = false;

        if (this.#interactiveManager) {
            this.#interactiveManager.unhook(false);
        }
    }

    /**
     * Clear the group: erase the rendered region and drop all children without
     * persisting any status icon.
     */
    public clear(): void {
        this.#clearSharedTimer();

        if (this.#interactiveManager && this.#isActive) {
            this.#interactiveManager.erase("stdout");
            this.#interactiveManager.unhook(false);
        }

        this.#spinners.clear();
        this.#isActive = false;
    }

    /** @internal */
    public renderAll(): void {
        if (!this.#interactiveManager || this.#spinners.size === 0) {
            return;
        }

        if (!this.#isActive) {
            this.#isActive = true;

            this.#interactiveManager.hook();
            this.#startSharedTimer();
        }

        const lines: string[] = [];

        for (const spinner of this.#spinners.values()) {
            lines.push(spinner.getFrameOutput());
        }

        if (lines.length > 0) {
            this.#interactiveManager.update("stdout", lines);
        }
    }

    /**
     * Start the single shared animation timer. Each tick advances every child by one
     * frame then performs a single batched redraw — O(N) work per tick total.
     */
    #startSharedTimer(): void {
        if (this.#sharedTimer) {
            return;
        }

        this.#sharedTimer = setInterval(() => {
            let anyActive = false;

            for (const spinner of this.#spinners.values()) {
                if (spinner.isRunning) {
                    spinner.tick();
                    anyActive = true;
                }
            }

            if (anyActive) {
                this.#renderLines();
            }
        }, this.#interval);

        this.#sharedTimer.unref();
    }

    #clearSharedTimer(): void {
        if (this.#sharedTimer) {
            clearInterval(this.#sharedTimer);
            this.#sharedTimer = undefined;
        }
    }

    /** Batched redraw without the hook bookkeeping in `renderAll`. */
    #renderLines(): void {
        if (!this.#interactiveManager) {
            return;
        }

        const lines: string[] = [];

        for (const spinner of this.#spinners.values()) {
            lines.push(spinner.getFrameOutput());
        }

        if (lines.length > 0) {
            this.#interactiveManager.update("stdout", lines);
        }
    }
}
