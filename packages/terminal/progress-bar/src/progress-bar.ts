import type { InteractiveManager } from "@visulima/interactive-manager";

import type { ProgressBarOptions, ProgressBarPayload } from "./types";
import { applyStyleToOptions, BRAILLE_CAP_LEFT, BRAILLE_CAP_RIGHT, getBarChar } from "./utils";

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

    public update(current: number, payload?: ProgressBarPayload): void {
        this.current = Math.max(0, Math.min(current, this.options.total));

        if (payload) {
            this.payload = { ...this.payload, ...payload };
        }

        if (this.interactiveManager && this.isActive) {
            const progressBar = this.render();

            this.interactiveManager.update("stdout", [progressBar]);
        }
    }

    public setPeak(peak: number): void {
        this.options.peak = peak;
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

            let barContent = "";

            for (let i = 0; i < width; i += 1) {
                if (i < filled) {
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

        let format = this.options.format ?? "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}";

        if (this.payload) {
            const entries = Object.entries(this.payload);

            for (const entry of entries) {
                const [k, v] = entry;

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

    private calculateETA(): number {
        if (this.current === 0) {
            return 0;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;

        if (elapsed < 0.1) {
            return 0;
        }

        const rate = this.current / elapsed;
        const remaining = this.options.total - this.current;

        return Math.round(remaining / rate);
    }
}
