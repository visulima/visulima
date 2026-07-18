/* eslint-disable max-classes-per-file */
import type { InteractiveManager } from "@visulima/interactive-manager";

import { ProgressBar } from "./progress-bar";
import type { MultiBarCreateOptions, MultiBarOptions, ProgressBarOptions, ProgressBarPayload } from "./types";
import { getBarChar } from "./utils";

const BAR_REGEX = /\[([^[\]]*)\]/u;

const CHAR_GRADIENTS: Record<string, string[]> = {
    braille: ["⣿", "⡷", "⢾"],
    default: ["█", "▓", "▒"],
    rect: ["▬", "▮", "▯"],
};

/**
 * @internal
 */
export class MultiBarInstance extends ProgressBar {
    private multiBar: MultiProgressBar;

    /** Timestamp (ms) of the last redraw this bar triggered, used for the per-bar `fps` throttle. */
    private lastBarRenderTime: number = 0;

    public constructor(multiBar: MultiProgressBar, options: ProgressBarOptions, payload?: ProgressBarPayload) {
        super(options, undefined, payload);
        this.multiBar = multiBar;
    }

    public override update(current: number, payload?: ProgressBarPayload): void {
        super.update(current, payload);

        // State is updated synchronously above; the actual terminal write is throttled
        // to the multi-bar's configured fps to keep rapid updates from rebuilding and
        // writing every bar's frame on every call (quadratic in bar count). The per-bar
        // `fps` (if lower) additionally caps how often this bar triggers a redraw.
        const state = this.getBarState();
        const complete = state.total > 0 && state.current >= state.total;

        if (complete || this.shouldRenderBar()) {
            this.lastBarRenderTime = Date.now();
            this.multiBar.renderAll(complete);
        }
    }

    public override start(total?: number, startValue?: number, payload?: ProgressBarPayload): void {
        super.start(total, startValue, payload);

        // A multi bar has no InteractiveManager of its own, so mutating total/value/payload
        // in start() would otherwise leave stale output until some bar next calls update().
        this.lastBarRenderTime = Date.now();
        this.multiBar.renderAll(true);
    }

    public override stop(): void {
        super.stop();
        this.multiBar.renderAll(true);
    }

    /**
     * Render the bar for composite compositing with per-bar glue and `formatBar`
     * disabled, so the `[{bar}]` region is exactly `width` raw characters (glue and
     * ANSI formatting would otherwise break width measurement and the bracket match).
     */
    public renderForComposite(): string {
        return this.render({ barGlue: "", formatBar: undefined });
    }

    public getBarGlue(): string {
        return this.options.barGlue ?? "";
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

    /** Whether the per-bar `fps` throttle permits triggering a redraw. */
    private shouldRenderBar(): boolean {
        const fps = this.options.fps ?? 10;

        if (fps <= 0) {
            return true;
        }

        return Date.now() - this.lastBarRenderTime >= 1000 / fps;
    }
}

/**
 * Multi-bar progress manager for displaying multiple progress bars simultaneously.
 *
 * Two layouts are supported. Stacked (default) renders one line per bar.
 * Composite (`composite: true`) merges all bars into a single bar where each column
 * is shaded by how many bars have filled it; composite layout requires the format to
 * contain a bracketed `[{bar}]` region, otherwise it falls back to the first bar's output.
 * @example
 * ```typescript
 * const multi = new MultiProgressBar({}, interactiveManager);
 * const bar1 = multi.create(100);
 * const bar2 = multi.create(200, 0, undefined, { style: "braille", width: 20 });
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

    /** Timestamp (ms) of the last live render, used to throttle by `fps`. */
    private lastRenderTime: number = 0;

    public constructor(options: MultiBarOptions = {}, interactiveManager?: InteractiveManager) {
        this.options = {
            barCompleteChar: getBarChar(undefined, options.style ?? "shades_classic"),
            barIncompleteChar: getBarChar(undefined, options.style ?? "shades_classic", false),
            composite: false,
            format: "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
            fps: 10,
            ...options,
        };
        this.composite = this.options.composite ?? false;
        this.interactiveManager = interactiveManager;

        if (this.composite && !BAR_REGEX.test(this.options.format ?? "")) {
            // eslint-disable-next-line no-console
            console.warn(
                "[@visulima/progress-bar] composite mode requires a bracketed `[{bar}]` region in `format`; rendering will fall back to the first bar.",
            );
        }
    }

    /**
     * Create and register a new bar.
     * @param total Total value for the new bar.
     * @param current Initial value.
     * @param payload Initial payload tokens.
     * @param barOptions Per-bar overrides (width, style, format, chars, glue, formatBar, fps); anything omitted falls back to the multi-bar defaults.
     * @returns The created bar instance.
     */
    public create(total: number, current: number = 0, payload?: ProgressBarPayload, barOptions: MultiBarCreateOptions = {}): ProgressBar {
        // eslint-disable-next-line no-plusplus
        const barId = `bar_${String(this.nextBarId++)}`;

        const style = barOptions.style ?? this.options.style;

        // When a per-bar style is supplied (and differs from the multi default), derive
        // the bar characters from that style instead of inheriting the multi-level chars,
        // unless the caller explicitly overrides them.
        const inheritChars = barOptions.style === undefined || barOptions.style === this.options.style;

        const bar = new MultiBarInstance(
            this,
            {
                barCompleteChar: barOptions.barCompleteChar ?? (inheritChars ? this.options.barCompleteChar : undefined),
                barGlue: barOptions.barGlue ?? this.options.barGlue,
                barIncompleteChar: barOptions.barIncompleteChar ?? (inheritChars ? this.options.barIncompleteChar : undefined),
                current,
                format: barOptions.format ?? this.options.format,
                formatBar: barOptions.formatBar ?? this.options.formatBar,
                fps: barOptions.fps ?? this.options.fps,
                style,
                total,
                width: barOptions.width ?? 40,
            },
            payload,
        );

        this.bars.set(barId, bar);

        if (!this.isActive && this.interactiveManager) {
            this.interactiveManager.hook();
            this.isActive = true;
            this.renderAll(true);
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
                    this.renderAll(true);
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Re-render every registered bar to the interactive manager.
     *
     * Live renders are throttled to the configured `fps`; calls that arrive faster
     * than one frame interval are coalesced (the underlying bar state is still updated
     * synchronously by the caller). Pass `force` to bypass the throttle — used for
     * structural changes (create/remove), completion, and the final frame on `stop()`.
     * @param force Render immediately, ignoring the fps throttle.
     */
    public renderAll(force: boolean = false): void {
        if (!this.interactiveManager || !this.isActive) {
            return;
        }

        if (!force && !this.shouldRender()) {
            return;
        }

        this.lastRenderTime = Date.now();

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

    public setBarColor(bar: ProgressBar, color: ((text: string) => string) | undefined): void {
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
        if (this.interactiveManager && this.isActive) {
            // Guarantee the final frame is shown even if the last update was throttled.
            this.renderAll(true);
            this.interactiveManager.unhook(false);
        }

        this.isActive = false;
        this.bars.clear();
        this.barColors.clear();
    }

    /** Whether enough time has elapsed since the last frame to render again. */
    private shouldRender(): boolean {
        const fps = this.options.fps ?? 10;

        if (fps <= 0) {
            return true;
        }

        return Date.now() - this.lastRenderTime >= 1000 / fps;
    }

    private renderComposite(bars: MultiBarInstance[]): string {
        if (bars.length === 0) {
            return "";
        }

        const firstBar = bars[0];

        if (!firstBar) {
            return "";
        }

        // Measure and inject against a line whose bar region is exactly `width` raw
        // characters — the first bar's glue and formatBar are stripped here so they can
        // neither double the measured width nor smuggle "[" bytes into BAR_REGEX.
        const output = firstBar.renderForComposite();

        const barMatch = BAR_REGEX.exec(output);

        if (!barMatch?.[1]) {
            return firstBar.render();
        }

        const width = barMatch[1].length;

        // Compute each bar's filled count and percentage once per frame
        // (instead of re-calling getBarState() per column inside getCompositeChar).
        const states = bars.map((bar) => {
            const state = bar.getBarState();
            const safeTotal = Math.max(1, state.total);

            return {
                color: this.barColors.get(bar),
                filled: Math.round((state.current / safeTotal) * width),
                percent: (state.current / safeTotal) * 100,
            };
        });

        const columns: string[] = [];

        for (let column = 0; column < width; column += 1) {
            const stack: number[] = [];

            for (const [index, state] of states.entries()) {
                if (column < state.filled) {
                    stack.push(index);
                }
            }

            columns.push(this.getCompositeChar(states, stack));
        }

        // Join with glue between columns (not after building) so per-column colors,
        // which may wrap a char in ANSI escapes, are never split by the glue.
        const composite = columns.join(firstBar.getBarGlue());

        // Use a replacer function so "$" sequences in colorized chars are not treated
        // as replacement patterns.
        return output.replace(BAR_REGEX, () => `[${composite}]`);
    }

    private getCompositeChar(states: { color?: (text: string) => string; filled: number; percent: number }[], stack: number[]): string {
        if (stack.length === 0) {
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
        const gradientLength = charGradient?.length ?? 1;
        // Shade by how many bars cover this column: fully-stacked columns pick the
        // densest char (index 0) and thinly-covered columns the lightest, so a column
        // every bar has filled never collapses onto the empty/incomplete character.
        const coverage = states.length > 0 ? stack.length / states.length : 1;
        const gradientIndex = Math.round((1 - coverage) * (gradientLength - 1));
        const char = charGradient?.[gradientIndex] ?? "█";

        let selectedBar: number | undefined;
        let smallestPercent = 100;

        for (const stackBarIndex of stack) {
            const state = states[stackBarIndex];

            if (!state) {
                continue;
            }

            const barPercent = state.percent;

            if (barPercent < smallestPercent || (barPercent === smallestPercent && (selectedBar === undefined || stackBarIndex > selectedBar))) {
                smallestPercent = barPercent;
                selectedBar = stackBarIndex;
            }
        }

        const barIndex = selectedBar ?? stack[0] ?? 0;
        const barColor = states[barIndex]?.color;

        return barColor ? barColor(char) : char;
    }
}
