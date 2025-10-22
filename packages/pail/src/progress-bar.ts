/* eslint-disable max-classes-per-file */

import type InteractiveManager from "./interactive/interactive-manager";
// Progress bar styles and types
export type ProgressBarStyle = "shades_classic" | "shades_grey" | "rect" | "filled" | "solid" | "ascii" | "custom";

export interface ProgressBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    barsize?: number;
    clear?: boolean;
    current?: number;
    etaBuffer?: number;
    format?: string;
    fps?: number;
    hideCursor?: boolean;
    lineWrap?: boolean;
    position?: "left" | "right" | "center";
    stream?: NodeJS.WriteStream;
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
    clearOnComplete?: boolean;
    composite?: boolean;
    format?: string;
    fps?: number;
    hideCursor?: boolean;
    stream?: NodeJS.WriteStream;
    style?: ProgressBarStyle;
}

export interface ProgressBarPayload {
    [key: string]: string | number | boolean;
}

// Helper functions for bar styles
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

    public constructor(options: ProgressBarOptions, interactiveManager?: InteractiveManager, payload?: ProgressBarPayload) {
        this.options = {
            barCompleteChar: Array.isArray(options.barCompleteChar) ? options.barCompleteChar : getBarChar(options.barCompleteChar, "shades_classic"),
            barGlue: "",
            barIncompleteChar: Array.isArray(options.barIncompleteChar)
                ? options.barIncompleteChar
                : getBarChar(options.barIncompleteChar, "shades_classic", false),
            barsize: 40,
            clear: false,
            current: 0,
            etaBuffer: 10,
            fps: 10,
            hideCursor: false,
            lineWrap: false,
            position: "left",
            stream: process.stdout,
            width: 40,
            ...options,
        };
        this.current = this.options.current ?? 0;
        this.startTime = Date.now();
        this.interactiveManager = interactiveManager;
        this.payload = payload;
    }

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

    public increment(step = 1, payload?: ProgressBarPayload): void {
        this.update(this.current + step, payload);
    }

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

                    barContent += isGradientBoundary ? completeChars[fractional - 1] : completeChar;
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
        const completeChar = typeof this.options.barCompleteChar === "string" ? this.options.barCompleteChar : "█";

        return {
            char: completeChar,
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

    public constructor(options: MultiBarOptions = {}, interactiveManager?: InteractiveManager) {
        this.options = {
            barCompleteChar: getBarChar(undefined, "shades_classic"),
            barGlue: "",
            barIncompleteChar: getBarChar(undefined, "shades_classic", false),
            clearOnComplete: false,
            format: "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
            fps: 10,
            hideCursor: false,
            stream: process.stdout,
            ...options,
        };
        this.composite = options.composite ?? false;
        this.interactiveManager = interactiveManager;
    }

    public create(total: number, startValue = 0, payload?: ProgressBarPayload): ProgressBar {
        // eslint-disable-next-line no-plusplus
        const barId = `bar_${this.nextBarId++}`;

        const bar = new MultiBarInstance(
            this,
            {
                barCompleteChar: this.options.barCompleteChar,
                barGlue: this.options.barGlue,
                barIncompleteChar: this.options.barIncompleteChar,
                current: startValue,
                format: this.options.format,
                fps: this.options.fps,
                stream: this.options.stream,
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
        const barMatch = output.match(/\[([^\]]*)\]/u);

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
        const composite = Array.from({ length: width }, (_, i) => this.getCompositeChar(bars, grid[i], i, width)).join("");

        // Replace the bar portion with composite
        return output.replace(/\[([^\]]*)\]/u, `[${composite}]`);
    }

    private getCompositeChar(bars: MultiBarInstance[], stack?: number[], position: number = 0, width: number = 40): string {
        if (!stack || stack.length === 0) {
            return "█";
        }

        let char: string;
        let barIndex: number | undefined;

        // Choose character based on stack depth (deeper stacks = lighter characters)
        switch (stack.length) {
            case 1: {
                char = "█"; // Solid for single layer

                break;
            }
            case 2: {
                char = "▓"; // Medium shade for 2 layers

                break;
            }
            case 3: {
                char = "▒"; // Lighter for 3 layers

                break;
            }
            default: {
                char = "░"; // Lightest for 4+ layers
            }
        }

        // For layering, show the highest-indexed bar that's filled at this position
        // This creates smooth color transitions based on actual progress
        // Calculate what percentage this position represents
        const positionPercent = (position / width) * 100;

        // Find the highest-indexed bar that's filled at this position
        let selectedBar: number | undefined;

        for (let i = stack.length - 1; i >= 0; i -= 1) {
            const barIndex_ = stack[i];
            const bar = bars[barIndex_];

            if (bar) {
                const barState = bar.getBarState();
                const barPercent = (barState.current / barState.total) * 100;

                if (positionPercent < barPercent) {
                    selectedBar = barIndex_;
                    break;
                }
            }
        }

        // Fallback to first bar in stack if none matched
        barIndex = selectedBar === undefined ? stack[0] : selectedBar;

        if (barIndex === undefined) {
            return char;
        }

        const targetBar = bars[barIndex];

        if (targetBar === undefined) {
            return char;
        }

        const barColor = this.barColors.get(targetBar);

        if (barColor) {
            return barColor(char);
        }

        return char;
    }

    public setBarColor(bar: ProgressBar, color: ((text: string) => string) | undefined): void {
        // Find the MultiBarInstance for this bar and set its color
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

    public stop(): void {
        this.isActive = false;

        if (this.interactiveManager) {
            this.interactiveManager.unhook(false);
        }
    }
}
