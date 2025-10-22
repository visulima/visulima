/* eslint-disable import/exports-last, max-classes-per-file */

import type { ColorizeType } from "@visulima/colorize";
import colorize from "@visulima/colorize";
import type { SpinnerName } from "cli-spinners";
// eslint-disable-next-line import/no-extraneous-dependencies
import spinners from "cli-spinners";

import type InteractiveManager from "./interactive/interactive-manager";

/**
 * Spinner style configuration using colorize.
 */
export interface SpinnerStyle {
    /** Background color name (e.g., "bgRed", "bgBlue") */
    bgColor?: string;
    /** Background color as hex (e.g., "#FF0000") */
    bgHex?: `#${string}`;
    /** Background color as RGB (e.g., [255, 0, 0]) */
    bgRgb?: [number, number, number];
    /** Apply bold style */
    bold?: boolean;
    /** Foreground color name (e.g., "red", "blue", "green") */
    color?: string;
    /** Apply dim/faint style */
    dim?: boolean;
    /** Foreground color as hex (e.g., "#FF0000") */
    hex?: `#${string}`;
    /** Apply inverse style (swap fg/bg) */
    inverse?: boolean;
    /** Apply italic style */
    italic?: boolean;
    /** Apply overline style */
    overline?: boolean;
    /** Foreground color as RGB (e.g., [255, 0, 0]) */
    rgb?: [number, number, number];
    /** Apply strikethrough style */
    strikethrough?: boolean;
    /** Apply underline style */
    underline?: boolean;
}

/**
 * Spinner completion icons.
 */
export interface SpinnerIcons {
    /** Icon to show on failure (default: "✖") */
    error?: string;
    /** Icon to show on info (default: "ℹ") */
    info?: string;
    /** Icon to show on success (default: "✓") */
    success?: string;
    /** Icon to show on warning (default: "⚠") */
    warning?: string;
}

/**
 * Spinner style options.
 */
export interface SpinnerOptions {
    /** Custom icons for completion states */
    icons?: SpinnerIcons;
    /** Name of the spinner from cli-spinners */
    name?: SpinnerName;
    /** Prefix text to show before the spinner */
    prefixText?: string;
    /** Style configuration for the spinner */
    style?: SpinnerStyle;
    /** Whether to output spinner (default: true) */
    verbose?: boolean;
}

/**
 * Options for starting a spinner.
 */
export interface SpinnerStartOptions {
    /** Prefix text to show before the spinner */
    prefixText?: string;
}

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
 * Apply style configuration to text using colorize.
 */
const applyStyle = (text: string, style?: SpinnerStyle): string => {
    if (!style) {
        return text;
    }

    let styled = colorize;

    // Apply styles
    if (style.bold)
        styled = styled.bold;

    if (style.dim)
        styled = styled.dim;

    if (style.italic)
        styled = styled.italic;

    if (style.underline)
        styled = styled.underline;

    if (style.strikethrough)
        styled = styled.strikethrough;

    if (style.inverse)
        styled = styled.inverse;

    if (style.overline)
        styled = styled.overline;

    // Apply foreground color
    if (style.color) {
        styled = styled[style.color as keyof typeof styled] as ColorizeType;
    } else if (style.hex) {
        styled = styled.hex(style.hex);
    } else if (style.rgb) {
        styled = styled.rgb(...style.rgb);
    }

    // Apply background color
    if (style.bgColor) {
        styled = styled[style.bgColor as keyof typeof styled] as ColorizeType;
    } else if (style.bgHex) {
        styled = styled.bgHex(style.bgHex);
    } else if (style.bgRgb) {
        styled = styled.bgRgb(...style.bgRgb);
    }

    return styled(text);
};

/**
 * Spinner class for creating loading indicators in terminal applications.
 *
 * Provides an easy-to-use interface for displaying spinners with various styles
 * from the cli-spinners library. Works seamlessly with interactive terminal features.
 * @example
 * ```typescript
 * const spinner = new Spinner({ name: "dots" });
 * spinner.start("Loading...");
 * // ... do work ...
 * spinner.succeed("Done!");
 * ```
 */
export class Spinner {
    #frame: number = 0;

    #frameInterval: ReturnType<typeof setInterval> | undefined;

    #isActive: boolean = false;

    #prefixText: string = "";

    #text: string = "";

    #startTime: number = 0;

    #interactiveManager?: InteractiveManager;

    #multiSpinner?: MultiSpinner;

    #finalOutput: string = "";

    readonly #spinnerName: SpinnerName;

    readonly #verbose: boolean;

    readonly #style?: SpinnerStyle;

    readonly #icons: Required<SpinnerIcons>;

    /**
     * Creates a new Spinner instance.
     * @param options Configuration options for the spinner
     * @param interactiveManager Optional interactive manager for terminal control
     */
    public constructor(options: SpinnerOptions = {}, interactiveManager?: InteractiveManager) {
        this.#spinnerName = options.name ?? "dots";
        this.#verbose = options.verbose !== false;
        this.#style = options.style;
        this.#prefixText = options.prefixText ?? "";
        this.#interactiveManager = interactiveManager;
        this.#icons = { ...DEFAULT_ICONS, ...options.icons };
    }

    /**
     * Current elapsed time in milliseconds.
     */
    public get elapsedTime(): number {
        return Date.now() - this.#startTime;
    }

    /**
     * Get or set the spinner text.
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
     * @param options
     * @param options.prefixText Optional prefix text to display
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
        this.#frame = 0;

        if (text) {
            this.#text = text;
        }

        if (options?.prefixText) {
            this.#prefixText = options.prefixText;
        }

        const manager = this.#multiSpinner || this.#interactiveManager;

        if (manager) {
            if (this.#multiSpinner) {
                (manager as MultiSpinner).renderAll();
            } else {
                (manager as InteractiveManager).hook();
                this.#render();
            }
        }

        // Start animation loop
        const spinner = spinners[this.#spinnerName];

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
        }
    }

    /**
     * Resume the spinner if it was paused.
     */
    public resume(): void {
        if (!this.#isActive) {
            return;
        }

        const spinner = spinners[this.#spinnerName];

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
        // If spinner is stopped, return the final output
        if (!this.#isActive && this.#finalOutput) {
            return this.#finalOutput;
        }

        const spinner = spinners[this.#spinnerName];
        const frame = spinner.frames[this.#frame];

        let output = applyStyle(frame as string, this.#style);

        if (this.#prefixText) {
            output = `${this.#prefixText} ${output}`;
        }

        if (this.#text) {
            output = `${output} ${this.#text}`;
        }

        return output;
    }

    /**
     * Render the current spinner frame.
     */
    #render(): void {
        if (this.#interactiveManager) {
            this.#interactiveManager.update("stdout", [this.getFrameOutput()]);
        }
    }

    /**
     * Stop the spinner with a given status.
     * @param status The status type (success, error, warning, info)
     * @param text Optional text to display
     */
    #stop(status: "success" | "error" | "warning" | "info", text?: string): void {
        if (!this.#isActive) {
            return;
        }

        if (this.#frameInterval) {
            clearInterval(this.#frameInterval);
            this.#frameInterval = undefined;
        }

        this.#isActive = false;

        if (!this.#verbose) {
            return;
        }

        let output = "";

        const icon = this.#icons[status];

        if (icon) {
            output = applyStyle(icon, this.#style);
        }

        if (this.#prefixText) {
            output = `${this.#prefixText} ${output}`;
        }

        if (text) {
            output = `${output} ${text}`;
        }

        this.#finalOutput = output;

        const manager = this.#multiSpinner || this.#interactiveManager;

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
 *
 * Allows displaying and updating multiple spinners simultaneously with
 * consistent formatting and management.
 * @example
 * ```typescript
 * const multiSpinner = new MultiSpinner({ name: "dots" });
 *
 * const spinner1 = multiSpinner.create("Task 1");
 * const spinner2 = multiSpinner.create("Task 2");
 *
 * spinner1.start();
 * spinner2.start();
 *
 * // ... do work ...
 *
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

    /**
     * Set the interactive manager for interactive mode.
     * @internal
     */
    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    /**
     * Create a new spinner instance.
     * @param text Initial text for the spinner
     * @param options
     * @param options.prefixText Optional prefix text to display
     * @param options.style Optional style for the spinner
     * @param options.verbose Whether to output spinner (default: true)
     * @returns A new Spinner instance
     */
    public create(text?: string, options: SpinnerOptions = {}): Spinner {
        // eslint-disable-next-line no-plusplus
        const id = `spinner_${this.#nextSpinnerId++}`;

        const spinner = new Spinner({ ...this.#options, ...options });

        spinner.setMultiSpinner(this);

        this.#spinners.set(id, spinner);

        if (text) {
            spinner.text = text;
        }

        return spinner;
    }

    /**
     * Remove a spinner from the multi-spinner manager.
     * @param spinner The spinner to remove
     * @returns True if the spinner was removed, false otherwise
     */
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

    /**
     * Stop all spinners.
     */
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

    /**
     * Clear all spinners without stopping them.
     */
    public clear(): void {
        this.#spinners.clear();
    }

    /**
     * Render all spinners.
     * @internal
     */
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

export type SpinnerType<T extends string = string, L extends string = string> = Record<T, L> & Spinner;
