/* eslint-disable max-classes-per-file */
import type { InteractiveManager } from "@visulima/interactive-manager";

import { ProgressBar } from "./progress-bar";
import type { MultiBarOptions, ProgressBarOptions, ProgressBarPayload } from "./types";
import { getBarChar } from "./utils";

const BAR_REGEX = /\[([^[\]]*)\]/u;

const CHAR_GRADIENTS: Record<string, string[]> = {
    braille: ["⣿", "⡷", "⢾", "⠤"],
    default: ["█", "▓", "▒", "░"],
    rect: ["▬", "▮", "▯", "▭"],
};

/**
 * @internal
 */
export class MultiBarInstance extends ProgressBar {
    private multiBar: MultiProgressBar;

    public constructor(multiBar: MultiProgressBar, options: ProgressBarOptions, payload?: ProgressBarPayload) {
        super(options, undefined, payload);
        this.multiBar = multiBar;
    }

    public override update(current: number, payload?: ProgressBarPayload): void {
        super.update(current, payload);
        this.multiBar.renderAll();
    }

    public getBarState(): { char: string; current: number; total: number } {
        const completeChar = Array.isArray(this.options.barCompleteChar)
            ? this.options.barCompleteChar.at(-1)
            : getBarChar(this.options.barCompleteChar, this.options.style ?? "shades_classic", true);

        return {
            char: completeChar ?? "█",
            current: this.current,
            total: this.options.total,
        };
    }
}

/**
 * Multi-bar progress manager for displaying multiple progress bars simultaneously.
 * @example
 * ```typescript
 * const multi = new MultiProgressBar({}, interactiveManager);
 * const bar1 = multi.create(100);
 * const bar2 = multi.create(200);
 * bar1.update(50);
 * bar2.update(100);
 * multi.stop();
 * ```
 */
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
            barIncompleteChar: getBarChar(undefined, "shades_classic", false),
            composite: false,
            format: "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
            fps: 10,
            ...options,
        };
        this.composite = this.options.composite ?? false;
        this.interactiveManager = interactiveManager;
    }

    public create(total: number, current: number = 0, payload?: ProgressBarPayload): ProgressBar {
        // eslint-disable-next-line no-plusplus
        const barId = `bar_${String(this.nextBarId++)}`;

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
            this.renderAll();
        }

        return bar;
    }

    public remove(bar: ProgressBar): boolean {
        for (const [id, existingBar] of this.bars.entries()) {
            if (existingBar === bar) {
                this.barColors.delete(existingBar);
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
            const barsArray = [...this.bars.values()];

            if (barsArray.length > 0) {
                const compositeOutput = this.renderComposite(barsArray);

                lines.push(compositeOutput);
            }
        } else {
            for (const bar of this.bars.values()) {
                lines.push(bar.render());
            }
        }

        this.interactiveManager.update("stdout", lines);
    }

    public setBarColor(bar: MultiBarInstance, color: ((text: string) => string) | undefined): void {
        for (const instance of this.bars.values()) {
            if (instance === bar) {
                if (color) {
                    this.barColors.set(instance, color);
                } else {
                    this.barColors.delete(instance);
                }

                break;
            }
        }
    }

    public stop(): void {
        this.isActive = false;

        if (this.interactiveManager) {
            this.interactiveManager.unhook(false);
        }

        this.bars.clear();
        this.barColors.clear();
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

        const barMatch = BAR_REGEX.exec(output);

        if (!barMatch?.[1]) {
            return output;
        }

        const width = barMatch[1].length;

        const grid: number[][] = Array.from({ length: width }, () => []);

        bars.forEach((bar, index) => {
            const state = bar.getBarState();
            const filled = Math.round((state.current / Math.max(1, state.total)) * width);

            for (let i = 0; i < width; i += 1) {
                if (i < filled) {
                    grid[i]?.push(index);
                }
            }
        });

        const composite = Array.from({ length: width }, (_, i) => this.getCompositeChar(bars, grid[i])).join("");

        return output.replace(BAR_REGEX, `[${composite}]`);
    }

    private getCompositeChar(bars: MultiBarInstance[], stack?: number[]): string {
        if (!stack || stack.length === 0) {
            return getBarChar(undefined, this.options.style ?? "shades_classic", false);
        }

        let gradientKey: string;

        if (this.options.style === "rect") {
            gradientKey = "rect";
        } else if (this.options.style === "braille") {
            gradientKey = "braille";
        } else {
            gradientKey = "default";
        }

        const charGradient = CHAR_GRADIENTS[gradientKey];
        const char = charGradient?.[Math.min(stack.length - 1, charGradient.length - 1)] ?? "█";

        let selectedBar: number | undefined;
        let smallestPercent = 100;

        for (const element of stack) {
            const stackBarIndex = element;
            const bar = bars[stackBarIndex];

            if (!bar) {
                continue;
            }

            const barState = bar.getBarState();
            const barPercent = (barState.current / Math.max(1, barState.total)) * 100;

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

        const barColor = this.barColors.get(targetBar);

        return barColor ? barColor(char) : char;
    }
}
