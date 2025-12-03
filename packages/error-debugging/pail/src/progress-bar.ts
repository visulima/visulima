/* eslint-disable max-classes-per-file */
import type InteractiveManager from "./interactive/interactive-manager";

const CHAR_GRADIENTS: Record<string, string[]> = {
    default: ["█", "▓", "▒", "░"],
    rect: ["▬", "▮", "▯", "▭"],
};

const BAR_REGEX = /\[([^[\]]*)\]/u;

export type ProgressBarStyle = "shades_classic" | "shades_grey" | "rect" | "filled" | "solid" | "ascii" | "custom";

export interface ProgressBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    current?: number;
    format?: string;
    fps?: number;
    style?: ProgressBarStyle;
    total: number;
    width?: number;
}

export interface SingleBarOptions extends ProgressBarOptions {
    format?: string;
}

export interface MultiBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    composite?: boolean;
    format?: string;
    fps?: number;
    style?: ProgressBarStyle;
}

export interface ProgressBarPayload {
    [key: string]: string | number | boolean;
}

// Helper functions for bar styles

/**
 * Gets the appropriate bar character based on style and completion state.
 * @param char Custom character override
 * @param style Progress bar style to use
 * @param complete Whether to get completed or incomplete character
 * @returns The appropriate character for the given style
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const getBarChar = (char: string | undefined, style: ProgressBarStyle, complete = true): string => {
    if (char) {
        return char;
    }

    switch (style) {
        case "ascii": {
            return complete ? "#" : "-";
        }
        case "filled": {
            return complete ? "█" : " ";
        }
        case "rect": {
            return complete ? "▬" : "▭";
        }
        case "shades_classic": {
            return complete ? "█" : "░";
        }
        case "shades_grey": {
            return complete ? "▓" : "░";
        }
        case "solid": {
            return complete ? "█" : " ";
        }
        default: {
            return complete ? "█" : "░";
        }
    }
};

// Apply style settings to options, allowing overrides
export const applyStyleToOptions = <T extends ProgressBarOptions | MultiBarOptions>(options: T): T => {
    if (!options.style) {
        return options;
    }

    const { style } = options;
    const result = { ...options };

    // Apply style defaults only if not explicitly set
    if (result.barCompleteChar === undefined) {
        result.barCompleteChar = getBarChar(undefined, style, true);
    }

    if (result.barIncompleteChar === undefined) {
        result.barIncompleteChar = getBarChar(undefined, style, false);
    }

    if (result.barGlue === undefined) {
        result.barGlue = "";
    }

    return result;
};

export class ProgressBar {
    protected options: ProgressBarOptions;

    protected current: number;

    private startTime: number;

    private interactiveManager?: InteractiveManager;

    private isActive: boolean = false;

    private payload?: ProgressBarPayload;

    /**
     * Creates a new progress bar instance.
     * @param options Configuration options for the progress bar
     * @param interactiveManager Optional interactive manager for rendering
     * @param payload Optional initial payload data for format placeholders
     */
    public constructor(options: ProgressBarOptions, interactiveManager?: InteractiveManager, payload?: ProgressBarPayload) {
        const isCompleteArray = Array.isArray(options.barCompleteChar);
        const isIncompleteArray = Array.isArray(options.barIncompleteChar);
        const isGradientMode = isCompleteArray || isIncompleteArray;

        const completeChar = isCompleteArray ? options.barCompleteChar : getBarChar(options.barCompleteChar as string | undefined, "shades_classic");
        const incompleteChar = isIncompleteArray
            ? options.barIncompleteChar
            : getBarChar(options.barIncompleteChar as string | undefined, "shades_classic", false);

        this.options = {
            barCompleteChar: completeChar,
            barIncompleteChar: incompleteChar,
            current: 0,
            fps: 10,
            width: 40,
            ...options,
        };

        // Normalize: if one is array but not the other, convert string to single-element array
        if (isGradientMode) {
            if (!Array.isArray(this.options.barCompleteChar)) {
                this.options.barCompleteChar = [this.options.barCompleteChar as string];
            }

            if (!Array.isArray(this.options.barIncompleteChar)) {
                this.options.barIncompleteChar = [this.options.barIncompleteChar as string];
            }
        }

        this.current = this.options.current ?? 0;
        this.startTime = Date.now();
        this.interactiveManager = interactiveManager;
        this.payload = payload;
    }

    /**
     * Updates the progress bar to a new value.
     * @param current The current progress value
     * @param payload Optional payload data to merge with existing data
     */
    public update(current: number, payload?: ProgressBarPayload): void {
        this.current = Math.min(current, this.options.total);

        if (payload) {
            this.payload = { ...this.payload, ...payload };
        }

        if (this.interactiveManager && this.isActive) {
            const progressBar = this.render();

            this.interactiveManager.update("stdout", [progressBar]);
        }
    }

    /**
     * Increments the progress bar by a specified step.
     * @param step Amount to increment (default: 1)
     * @param payload Optional payload data to merge with existing data
     */
    public increment(step = 1, payload?: ProgressBarPayload): void {
        this.update(this.current + step, payload);
    }

    /**
     * Renders the progress bar as a formatted string.
     * @returns Formatted progress bar string with all placeholders replaced
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public render(): string {
        const total = this.options.total > 0 ? this.options.total : 1;
        const width = Math.max(0, this.options.width ?? 40);
        const percentage = Math.max(0, Math.min(100, Math.round((this.current / total) * 100)));
        const filled = Math.max(0, Math.min(width, Math.round((this.current / total) * width)));
        const empty = width - filled;

        // Handle both string and array types for bar characters
        let bar: string;

        if (Array.isArray(this.options.barCompleteChar) || Array.isArray(this.options.barIncompleteChar)) {
            // Gradient array mode
            const completeChars = Array.isArray(this.options.barCompleteChar) ? this.options.barCompleteChar : undefined;
            const incompleteChars = Array.isArray(this.options.barIncompleteChar) ? this.options.barIncompleteChar : undefined;

            const completeChar
                = completeChars?.[completeChars.length - 1] ?? (typeof this.options.barCompleteChar === "string" ? this.options.barCompleteChar : "█");
            const incompleteChar = incompleteChars?.[0] ?? (typeof this.options.barIncompleteChar === "string" ? this.options.barIncompleteChar : "░");
            const completeLength = completeChars?.length ?? 1;

            // Calculate fractional position for gradient animation
            const progressRatio = this.current / total;
            const totalSteps = width * completeLength;
            const currentStep = Math.round(progressRatio * totalSteps);
            const fractional = currentStep % completeLength;

            let barContent = "";

            for (let i = 0; i < width; i += 1) {
                if (i < filled) {
                    const isGradientBoundary = i === filled - 1 && fractional > 0 && completeChars;

                    barContent += isGradientBoundary ? completeChars[Math.max(0, fractional - 1)] : completeChar;
                } else {
                    barContent += incompleteChar;
                }
            }

            bar = barContent;
        } else {
            // Standard mode with string characters
            const completeChar = typeof this.options.barCompleteChar === "string" ? this.options.barCompleteChar : "█";
            const incompleteChar = typeof this.options.barIncompleteChar === "string" ? this.options.barIncompleteChar : "░";

            bar = completeChar.repeat(filled) + incompleteChar.repeat(empty);
        }

        let format = this.options.format ?? "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}";

        if (this.payload) {
            for (const [k, v] of Object.entries(this.payload)) {
                format = format.replaceAll(`{${k}}`, String(v));
            }
        }

        const eta = this.calculateETA();

        return format
            .replaceAll("{bar}", bar)
            .replaceAll("{percentage}", String(percentage))
            .replaceAll("{value}", String(this.current))
            .replaceAll("{total}", String(this.options.total))
            .replaceAll("{eta}", String(eta));
    }

    /**
     * Starts the progress bar.
     * @param total Optional total value to set
     * @param startValue Optional starting value
     * @param payload Optional initial payload data
     */
    public start(total?: number, startValue?: number, payload?: ProgressBarPayload): void {
        if (total !== undefined) {
            this.options.total = total;
        }

        if (startValue !== undefined) {
            this.current = startValue;
        }

        this.startTime = Date.now();
        this.isActive = true;

        if (this.interactiveManager) {
            this.interactiveManager.hook();
            this.update(this.current, payload);
        }
    }

    /**
     * Stops the progress bar and cleanup.
     */
    public stop(): void {
        this.isActive = false;

        if (this.interactiveManager) {
            this.interactiveManager.unhook(false);
        }
    }

    private calculateETA(): number {
        if (this.current === 0) {
            return 0;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;

        // Guard against very small elapsed time
        if (elapsed < 0.1) {
            return 0;
        }

        const rate = this.current / elapsed;
        const remaining = this.options.total - this.current;

        return Math.round(remaining / rate);
    }
}

export class MultiBarInstance extends ProgressBar {
    private multiBar: MultiProgressBar;

    public constructor(multiBar: MultiProgressBar, options: ProgressBarOptions, payload?: ProgressBarPayload) {
        // Don't pass interactiveManager to prevent individual bar updates
        super(options, undefined, payload);
        this.multiBar = multiBar;
    }

    public override update(current: number, payload?: ProgressBarPayload): void {
        // Update the progress value using parent method but skip individual display
        super.update(current, payload);

        // Let the multi-bar handle the coordinated display
        this.multiBar.renderAll();
    }

    public getBarState(): { char: string; current: number; total: number } {
        const completeChar = Array.isArray(this.options.barCompleteChar)
            ? this.options.barCompleteChar[this.options.barCompleteChar.length - 1]
            : getBarChar(this.options.barCompleteChar, this.options.style ?? "shades_classic", true);

        return {
            char: completeChar ?? "█",
            current: this.current,
            total: this.options.total,
        };
    }
}

export class MultiProgressBar {
    private bars = new Map<string, MultiBarInstance>();

    private options: MultiBarOptions;

    private interactiveManager?: InteractiveManager;

    private isActive: boolean = false;

    private nextBarId: number = 0;

    private composite: boolean = false;

    private barColors = new Map<MultiBarInstance, (text: string) => string>();

    /**
     * Creates a new multi progress bar manager.
     * @param options Configuration options for the progress bars
     * @param interactiveManager Optional interactive manager for rendering
     */
    public constructor(options: MultiBarOptions = {}, interactiveManager?: InteractiveManager) {
        this.options = {
            barCompleteChar: getBarChar(undefined, "shades_classic"),
            barIncompleteChar: getBarChar(undefined, "shades_classic", false),
            composite: false,
            format: "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
            fps: 10,
            ...options,
        };
        this.composite = this.options.composite ?? false;
        this.interactiveManager = interactiveManager;
    }

    /**
     * Creates a new progress bar within this multi-bar manager.
     * @param total Total value for the progress bar
     * @param current Starting current value (default: 0)
     * @param payload Optional initial payload data for format placeholders
     * @returns The created progress bar instance
     */
    public create(total: number, current: number = 0, payload?: ProgressBarPayload): ProgressBar {
        // eslint-disable-next-line no-plusplus
        const barId = `bar_${this.nextBarId++}`;

        const bar = new MultiBarInstance(
            this,
            {
                barCompleteChar: this.options.barCompleteChar,
                barIncompleteChar: this.options.barIncompleteChar,
                current,
                format: this.options.format,
                fps: this.options.fps,
                total,
                width: 40,
            },
            payload,
        );

        this.bars.set(barId, bar);

        if (!this.isActive && this.interactiveManager) {
            this.interactiveManager.hook();
            this.isActive = true;
            // Initial render of all bars
            this.renderAll();
        }

        return bar;
    }

    /**
     * Removes a progress bar from the manager.
     * @param bar The progress bar instance to remove
     * @returns True if the bar was removed, false if not found
     */
    public remove(bar: ProgressBar): boolean {
        // Find and remove the bar by reference
        for (const [id, existingBar] of this.bars.entries()) {
            if (existingBar === bar) {
                this.bars.delete(id);

                if (this.bars.size === 0) {
                    if (this.interactiveManager) {
                        this.interactiveManager.unhook(false);
                    }

                    this.isActive = false;
                } else {
                    this.renderAll();
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Renders all progress bars.
     */
    public renderAll(): void {
        if (!this.interactiveManager || !this.isActive) {
            return;
        }

        const lines: string[] = [];

        if (this.composite) {
            // Composite mode: render all bars as a single composite line
            const barsArray = [...this.bars.values()];

            if (barsArray.length > 0) {
                const compositeOutput = this.renderComposite(barsArray);

                lines.push(compositeOutput);
            }
        } else {
            // Standard mode: render each bar on its own line
            for (const bar of this.bars.values()) {
                lines.push(bar.render());
            }
        }

        this.interactiveManager.update("stdout", lines);
    }

    /**
     * Sets or removes a color function for a specific bar.
     * @param bar The progress bar instance to color (must be from this MultiProgressBar)
     * @param color Color function or undefined to remove color
     */
    public setBarColor(bar: MultiBarInstance, color: ((text: string) => string) | undefined): void {
        for (const instance of this.bars.values()) {
            if (instance === bar) {
                if (color) {
                    this.barColors.set(instance, color);
                } else {
                    this.barColors.delete(instance);
                }

                // Don't render here - let update() trigger the render
                break;
            }
        }
    }

    /**
     * Stops all progress bars and cleanup.
     */
    // eslint-disable-next-line sonarjs/no-identical-functions
    public stop(): void {
        this.isActive = false;

        if (this.interactiveManager) {
            this.interactiveManager.unhook(false);
        }
    }

    private renderComposite(bars: MultiBarInstance[]): string {
        if (bars.length === 0) {
            return "";
        }

        const firstBar = bars[0];

        if (!firstBar) {
            return "";
        }

        const output = firstBar.render();

        // Extract the bar portion
        const barMatch = output.match(BAR_REGEX);

        if (!barMatch || !barMatch[1]) {
            return output;
        }

        const width = barMatch[1].length;

        // Create grid for each position with number arrays
        const grid: number[][] = Array.from({ length: width }, () => []);

        // Build grid with all progress bars
        bars.forEach((bar, index) => {
            const state = bar.getBarState();
            const filled = Math.round((state.current / state.total) * width);

            for (let i = 0; i < width; i += 1) {
                if (i < filled) {
                    grid[i]?.push(index);
                }
            }
        });

        // Render with z-index layering and colors
        const composite = Array.from({ length: width }, (_, i) => this.getCompositeChar(bars, grid[i])).join("");

        // Replace the bar portion with composite
        return output.replace(BAR_REGEX, `[${composite}]`);
    }

    private getCompositeChar(bars: MultiBarInstance[], stack?: number[]): string {
        // Handle empty stack
        if (!stack || stack.length === 0) {
            const defaultBar = bars[0];

            return defaultBar?.getBarState().char ?? "█";
        }

        // Get character gradient based on bar style
        const charGradient = CHAR_GRADIENTS[this.options.style === "rect" ? "rect" : "default"];
        const char = charGradient?.[Math.min(stack.length - 1, charGradient.length - 1)] ?? "█";

        // Find bar with smallest progress (highest priority for visibility)
        let selectedBar: number | undefined;
        let smallestPercent = 100;

        for (const stackBarIndex of stack) {
            const bar = bars[stackBarIndex];

            if (!bar) {
                continue;
            }

            const barState = bar.getBarState();
            const barPercent = (barState.current / barState.total) * 100;

            // Select the bar with smallest progress; if tied, prefer higher index
            if (barPercent < smallestPercent || (barPercent === smallestPercent && (selectedBar === undefined || stackBarIndex > selectedBar))) {
                smallestPercent = barPercent;
                selectedBar = stackBarIndex;
            }
        }

        const barIndex = selectedBar ?? stack[0];
        const targetBar = bars[barIndex ?? 0];

        if (!targetBar) {
            return char;
        }

        // Apply color if set, otherwise return plain character
        const barColor = this.barColors.get(targetBar);

        return barColor ? barColor(char) : char;
    }
}
