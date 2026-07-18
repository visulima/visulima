import type { InteractiveManager } from "@visulima/interactive-manager";

import type { ProgressBarOptions, ProgressBarPayload } from "./types";
import { applyStyleToOptions, BRAILLE_CAP_LEFT, BRAILLE_CAP_RIGHT, getBarChar } from "./utils";

/** Default number of progress samples kept for the sliding-window ETA estimate. */
const ETA_BUFFER_LENGTH = 30;

/**
 * Format a duration (in seconds) as a compact human string, e.g. `90s` becomes `1m30s`.
 * @param seconds Duration in whole seconds.
 * @returns Compact string such as `45s`, `1m30s`, or `1h05m`.
 */
const formatDuration = (seconds: number): string => {
    const safe = Math.max(0, Math.round(seconds));

    if (safe < 60) {
        return `${String(safe)}s`;
    }

    if (safe < 3600) {
        const minutes = Math.floor(safe / 60);
        const remainder = safe % 60;

        return `${String(minutes)}m${String(remainder).padStart(2, "0")}s`;
    }

    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);

    return `${String(hours)}h${String(minutes).padStart(2, "0")}m`;
};

/**
 * Terminal progress bar with multiple styles, gradient support, and peak markers.
 * @example
 * ```typescript
 * const bar = new ProgressBar({ total: 100 });
 * bar.start();
 * bar.update(50);
 * bar.stop();
 * ```
 */
// eslint-disable-next-line import/prefer-default-export
export class ProgressBar {
    protected options: ProgressBarOptions;

    protected current: number;

    private startTime: number;

    private interactiveManager?: InteractiveManager;

    private isActive: boolean = false;

    private payload?: ProgressBarPayload;

    /** Timestamp (ms) of the last live render, used to throttle by `fps`. */
    private lastRenderTime: number = 0;

    /** Sliding window of `{ time, value }` samples for rate/ETA estimation. */
    private etaBuffer: { time: number; value: number }[] = [];

    public constructor(rawOptions: ProgressBarOptions, interactiveManager?: InteractiveManager, payload?: ProgressBarPayload) {
        const options = applyStyleToOptions(rawOptions);

        const isCompleteArray = Array.isArray(options.barCompleteChar);
        const isIncompleteArray = Array.isArray(options.barIncompleteChar);
        const isGradientMode = isCompleteArray || isIncompleteArray;

        const effectiveStyle = options.style ?? "shades_classic";
        const completeChar = isCompleteArray ? options.barCompleteChar : getBarChar(options.barCompleteChar as string | undefined, effectiveStyle);
        const incompleteChar = isIncompleteArray
            ? options.barIncompleteChar
            : getBarChar(options.barIncompleteChar as string | undefined, effectiveStyle, false);

        this.options = {
            barCompleteChar: completeChar,
            barIncompleteChar: incompleteChar,
            current: 0,
            fps: 10,
            width: 40,
            ...options,
        };

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
     * Set the current value of the bar and re-render (live) if attached & active.
     *
     * Live renders are throttled to the configured `fps`; the final frame is
     * always flushed by `stop()`. When `stopOnComplete` is set and the bar
     * reaches `total`, the bar auto-stops.
     * @param current New absolute value (clamped to `[0, total]`).
     * @param payload Optional payload tokens merged into the existing payload.
     */
    public update(current: number, payload?: ProgressBarPayload): void {
        this.current = Math.max(0, Math.min(current, this.options.total));

        if (payload) {
            this.payload = { ...this.payload, ...payload };
        }

        this.recordSample();

        if (this.interactiveManager && this.isActive) {
            const complete = this.options.total > 0 && this.current >= this.options.total;

            if (this.shouldRender() || complete) {
                this.flush();
            }

            if (complete && this.options.stopOnComplete) {
                this.stop();
            }
        }
    }

    /**
     * Set the peak marker position (in the same units as `total`).
     * @param peak Peak value to mark on the bar; values at or below zero disable the marker.
     */
    public setPeak(peak: number): void {
        this.options.peak = peak;
    }

    /**
     * Increment the current value by `step` and re-render (subject to throttling).
     * @param step Amount to add to the current value.
     * @param payload Optional payload tokens merged into the existing payload.
     */
    public increment(step = 1, payload?: ProgressBarPayload): void {
        this.update(this.current + step, payload);
    }

    /**
     * Render the bar to a string using the configured format and tokens.
     *
     * Supported tokens: `{bar}`, `{percentage}`, `{value}`, `{total}`, `{eta}`,
     * `{eta_formatted}`, `{duration}`, `{rate}`, plus any `payload` key.
     * @returns The fully interpolated bar line.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public render(): string {
        const total = this.options.total > 0 ? this.options.total : 1;
        const width = Math.max(0, this.options.width ?? 40);
        const percentage = Math.max(0, Math.min(100, Math.round((this.current / total) * 100)));
        const filled = Math.max(0, Math.min(width, Math.round((this.current / total) * width)));
        const empty = width - filled;

        let bar: string;

        const useCaps = this.options.roundedCaps === true || (this.options.roundedCaps === undefined && this.options.style === "braille");

        if (Array.isArray(this.options.barCompleteChar) || Array.isArray(this.options.barIncompleteChar)) {
            const completeChars = Array.isArray(this.options.barCompleteChar) ? this.options.barCompleteChar : undefined;
            const incompleteChars = Array.isArray(this.options.barIncompleteChar) ? this.options.barIncompleteChar : undefined;

            // eslint-disable-next-line @stylistic/operator-linebreak
            const completeChar =
                completeChars?.[completeChars.length - 1] ?? (typeof this.options.barCompleteChar === "string" ? this.options.barCompleteChar : "█");
            const incompleteChar = incompleteChars?.[0] ?? (typeof this.options.barIncompleteChar === "string" ? this.options.barIncompleteChar : "░");
            const completeLength = completeChars?.length ?? 1;

            const progressRatio = this.current / total;
            const totalSteps = width * completeLength;
            const currentStep = Math.round(progressRatio * totalSteps);
            const fractional = currentStep % completeLength;

            const peakPos = this.calculatePeakPosition(width, total, filled);
            const peakChar = this.options.peakChar ?? completeChar;

            let barContent = "";

            for (let i = 0; i < width; i += 1) {
                if (peakPos !== undefined && i === peakPos) {
                    barContent += peakChar;
                } else if (i < filled) {
                    const isGradientBoundary = i === filled - 1 && fractional > 0 && completeChars;

                    // eslint-disable-next-line @stylistic/no-extra-parens
                    barContent += isGradientBoundary ? (completeChars[Math.max(0, fractional - 1)] ?? completeChar) : completeChar;
                } else {
                    barContent += incompleteChar;
                }
            }

            bar = barContent;
        } else {
            const completeChar = typeof this.options.barCompleteChar === "string" ? this.options.barCompleteChar : "█";
            const incompleteChar = typeof this.options.barIncompleteChar === "string" ? this.options.barIncompleteChar : "░";

            const peakPos = this.calculatePeakPosition(width, total, filled);
            const peakChar = this.options.peakChar ?? completeChar;

            if (peakPos === undefined) {
                bar = completeChar.repeat(filled) + incompleteChar.repeat(empty);
            } else {
                let barContent = "";

                for (let i = 0; i < width; i += 1) {
                    if (i === peakPos) {
                        barContent += peakChar;
                    } else if (i < filled) {
                        barContent += completeChar;
                    } else {
                        barContent += incompleteChar;
                    }
                }

                bar = barContent;
            }
        }

        if (useCaps && width >= 2) {
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            const chars = [...bar];

            chars[0] = BRAILLE_CAP_LEFT;
            chars[chars.length - 1] = BRAILLE_CAP_RIGHT;
            bar = chars.join("");
        }

        const barGlue = this.options.barGlue ?? "";

        if (barGlue !== "") {
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            bar = [...bar].join(barGlue);
        }

        if (this.options.formatBar) {
            bar = this.options.formatBar(bar, { percentage, total: this.options.total, value: this.current });
        }

        let format = this.options.format ?? "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}";

        if (this.payload) {
            const entries = Object.entries(this.payload);

            for (const entry of entries) {
                const [k, v] = entry;

                format = format.replaceAll(`{${k}}`, String(v));
            }
        }

        const eta = this.calculateETA();
        const duration = Math.max(0, (Date.now() - this.startTime) / 1000);
        const rate = this.calculateRate();

        return format
            .replaceAll("{bar}", bar)
            .replaceAll("{percentage}", String(percentage))
            .replaceAll("{value}", String(this.current))
            .replaceAll("{total}", String(this.options.total))
            .replaceAll("{eta_formatted}", formatDuration(eta))
            .replaceAll("{eta}", String(eta))
            .replaceAll("{duration}", formatDuration(duration))
            .replaceAll("{rate}", String(Math.round(rate)));
    }

    /**
     * Activate the bar and (if attached) hook the interactive manager.
     * @param total Optional new total.
     * @param startValue Optional new starting value.
     * @param payload Optional initial payload tokens.
     */
    public start(total?: number, startValue?: number, payload?: ProgressBarPayload): void {
        if (total !== undefined) {
            this.options.total = total;
        }

        if (startValue !== undefined) {
            this.current = startValue;
        }

        this.startTime = Date.now();
        this.lastRenderTime = 0;
        this.etaBuffer = [];
        this.isActive = true;
        this.recordSample();

        if (payload) {
            this.payload = { ...this.payload, ...payload };
        }

        if (this.interactiveManager) {
            this.interactiveManager.hook();

            // Force the initial frame regardless of payload presence / throttle.
            this.flush();
        }
    }

    /**
     * Deactivate the bar. Flushes a final frame (or erases it when
     * `clearOnComplete` is set) and unhooks the interactive manager.
     */
    public stop(): void {
        if (!this.isActive) {
            return;
        }

        this.isActive = false;

        if (this.interactiveManager) {
            if (this.options.clearOnComplete) {
                this.interactiveManager.erase("stdout");
            } else {
                // Guarantee the final frame is shown even if the last update was throttled.
                this.interactiveManager.update("stdout", [this.render()]);
            }

            this.interactiveManager.unhook(false);
        }
    }

    /** Push the current frame to the interactive manager and reset the throttle clock. */
    private flush(): void {
        if (!this.interactiveManager) {
            return;
        }

        this.lastRenderTime = Date.now();
        this.interactiveManager.update("stdout", [this.render()]);
    }

    /** Whether enough time has elapsed since the last frame to render again. */
    private shouldRender(): boolean {
        const fps = this.options.fps ?? 10;

        if (fps <= 0) {
            return true;
        }

        return Date.now() - this.lastRenderTime >= 1000 / fps;
    }

    /** Record a `{ time, value }` sample into the sliding ETA buffer. */
    private recordSample(): void {
        this.etaBuffer.push({ time: Date.now(), value: this.current });

        if (this.etaBuffer.length > ETA_BUFFER_LENGTH) {
            this.etaBuffer.shift();
        }
    }

    /** Items-per-second over the sliding window (falls back to whole-run average). */
    private calculateRate(): number {
        if (this.etaBuffer.length >= 2) {
            const first = this.etaBuffer[0];
            const last = this.etaBuffer[this.etaBuffer.length - 1];

            if (first && last) {
                const deltaTime = (last.time - first.time) / 1000;
                const deltaValue = last.value - first.value;

                if (deltaTime > 0 && deltaValue > 0) {
                    return deltaValue / deltaTime;
                }
            }
        }

        const elapsed = (Date.now() - this.startTime) / 1000;

        if (elapsed <= 0 || this.current <= 0) {
            return 0;
        }

        return this.current / elapsed;
    }

    private calculatePeakPosition(width: number, total: number, filled: number): number | undefined {
        const { peak } = this.options;

        if (peak === undefined || peak <= 0) {
            return undefined;
        }

        let peakPos = Math.max(0, Math.min(width - 1, Math.floor((peak / total) * width)));

        if (peakPos < filled - 1) {
            peakPos = filled - 1;
        }

        return peakPos;
    }

    /**
     * Estimate seconds remaining using the sliding-window rate. This is far more
     * stable for variable-rate work (downloads, network) than a whole-run average.
     */
    private calculateETA(): number {
        if (this.current === 0) {
            return 0;
        }

        const rate = this.calculateRate();

        if (rate <= 0) {
            return 0;
        }

        const remaining = this.options.total - this.current;

        if (remaining <= 0) {
            return 0;
        }

        return Math.round(remaining / rate);
    }
}
