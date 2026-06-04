/* eslint-disable max-classes-per-file */

import { styleText } from "node:util";

import type { InteractiveManager } from "@visulima/interactive-manager";

import { getSpinner } from "./spinners";
import type { SpinnerIcons, SpinnerName, SpinnerOptions, SpinnerStartOptions, SpinnerStyle } from "./types";

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
 * Works standalone with direct stream output, or with an InteractiveManager
 * for coordinated terminal output (e.g., alongside progress bars or logs).
 * @example
 * ```typescript
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

    readonly #spinnerName: SpinnerName;

    readonly #verbose: boolean;

    readonly #applyStyle?: (text: string) => string;

    readonly #icons: Required<SpinnerIcons>;

    /**
     * Creates a new Spinner instance.
     * @param options Configuration options for the spinner
     * @param interactiveManager Optional interactive manager for terminal control
     */
    public constructor(options: SpinnerOptions = {}, interactiveManager?: InteractiveManager) {
        this.#spinnerName = options.name ?? "dots";
        this.#verbose = options.verbose !== false;
        this.#prefixText = options.prefixText ?? "";

        this.#interactiveManager = interactiveManager;
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
        return (this.#endTime || Date.now()) - this.#startTime;
    }

    /**
     * Get or set the spinner text.
     */
    public get text(): string {
        return this.#text;
    }

    /**
     * Get the spinner text.
     * @deprecated Use the `text` getter instead.
     */
    public get getText(): string {
        return this.#text;
    }

    public set text(value: string) {
        this.#text = value;

        if (this.#isActive) {
            if (this.#multiSpinner) {
                this.#multiSpinner.renderAll();
            } else if (this.#interactiveManager) {
                this.#render();
            }
        }
    }

    /**
     * Get or set the prefix text.
     */
    public get prefixText(): string {
        return this.#prefixText;
    }

    /**
     * Get the prefix text.
     * @deprecated Use the `prefixText` getter instead.
     */
    public get getPrefixText(): string {
        return this.#prefixText;
    }

    public set prefixText(value: string) {
        this.#prefixText = value;

        if (this.#isActive) {
            if (this.#multiSpinner) {
                this.#multiSpinner.renderAll();
            } else if (this.#interactiveManager) {
                this.#render();
            }
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

        if (text) {
            this.#text = text;
        }

        if (options?.prefixText) {
            this.#prefixText = options.prefixText;
        }

        const manager = this.#multiSpinner ?? this.#interactiveManager;

        if (manager) {
            if (this.#multiSpinner) {
                (manager as MultiSpinner).renderAll();
            } else {
                (manager as InteractiveManager).hook();
                this.#render();
            }
        }

        // Start animation loop
        const spinner = getSpinner(this.#spinnerName);

        this.#frameInterval = setInterval(() => {
            if (this.#isActive) {
                this.#frame = (this.#frame + 1) % spinner.frames.length;

                if (this.#multiSpinner) {
                    this.#multiSpinner.renderAll();
                } else if (this.#interactiveManager) {
                    this.#render();
                }
            }
        }, spinner.interval);

        return this;
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
        if (this.#frameInterval) {
            clearInterval(this.#frameInterval);
            this.#frameInterval = undefined;
        }
    }

    /**
     * Resume the spinner if it was paused.
     */
    public resume(): void {
        if (!this.#isActive) {
            return;
        }

        if (this.#frameInterval) {
            clearInterval(this.#frameInterval);
        }

        const spinner = getSpinner(this.#spinnerName);

        this.#frameInterval = setInterval(() => {
            if (this.#isActive) {
                this.#frame = (this.#frame + 1) % spinner.frames.length;

                if (this.#multiSpinner) {
                    this.#multiSpinner.renderAll();
                } else if (this.#interactiveManager) {
                    this.#render();
                }
            }
        }, spinner.interval);
    }

    /**
     * Get current frame output.
     * @internal
     */
    public getFrameOutput(): string {
        if (!this.#isActive && this.#finalOutput) {
            return this.#finalOutput;
        }

        const spinner = getSpinner(this.#spinnerName);
        const frame = spinner.frames[this.#frame] as string;

        let output = this.#applyStyle ? this.#applyStyle(frame) : frame;

        if (this.#prefixText) {
            output = `${this.#prefixText} ${output}`;
        }

        if (this.#text) {
            output = `${output} ${this.#text}`;
        }

        return output;
    }

    #render(): void {
        if (this.#interactiveManager) {
            this.#interactiveManager.update("stdout", [this.getFrameOutput()]);
        }
    }

    #stop(status: "error" | "info" | "success" | "warning", text?: string): void {
        if (!this.#isActive) {
            return;
        }

        if (this.#frameInterval) {
            clearInterval(this.#frameInterval);
            this.#frameInterval = undefined;
        }

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

        this.#finalOutput = output;

        const manager = this.#multiSpinner ?? this.#interactiveManager;

        if (manager) {
            if (this.#multiSpinner) {
                this.#multiSpinner.renderAll();
            } else if (this.#interactiveManager) {
                this.#interactiveManager.update("stdout", [output]);

                this.#interactiveManager.unhook(false);
            }
        }
    }
}

/**
 * Multi-Spinner class for managing multiple spinners concurrently.
 * @example
 * ```typescript
 * const multiSpinner = new MultiSpinner({ name: "dots" }, interactiveManager);
 * const spinner1 = multiSpinner.create("Task 1");
 * const spinner2 = multiSpinner.create("Task 2");
 * spinner1.start();
 * spinner2.start();
 * spinner1.succeed();
 * spinner2.succeed();
 * multiSpinner.stop();
 * ```
 */
export class MultiSpinner {
    #spinners = new Map<string, Spinner>();

    #nextSpinnerId: number = 0;

    #interactiveManager?: InteractiveManager;

    #isActive: boolean = false;

    readonly #options: SpinnerOptions;

    public constructor(options: SpinnerOptions = {}, interactiveManager?: InteractiveManager) {
        this.#options = options;

        this.#interactiveManager = interactiveManager;
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
                this.renderAll();

                return true;
            }
        }

        return false;
    }

    public stop(): void {
        for (const spinner of this.#spinners.values()) {
            spinner.succeed();
        }

        this.#spinners.clear();
        this.#isActive = false;

        if (this.#interactiveManager) {
            this.#interactiveManager.unhook(false);
        }
    }

    public clear(): void {
        for (const spinner of this.#spinners.values()) {
            spinner.succeed();
        }

        this.#spinners.clear();
    }

    /** @internal */
    public renderAll(): void {
        if (!this.#interactiveManager) {
            return;
        }

        if (!this.#isActive) {
            this.#isActive = true;

            this.#interactiveManager.hook();
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
