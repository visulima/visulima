/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { CwvRating, MemoryInfo, PerformanceSnapshot } from "../../performance/monitor";
import { getCwvRating, performanceMonitor } from "../../performance/monitor";
import type { AppTooltipProps } from "../../types/app";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const RATING_CLASSES: Record<CwvRating, string> = {
    good: "text-success-foreground",
    "needs-improvement": "text-warning-foreground",
    poor: "text-destructive",
};

// ─── Tiny sparkline (40px × 24px) ────────────────────────────────────────────

const MiniSparkline = ({ samples }: { samples: number[] }): ComponentChildren => {
    const W = 60;
    const H = 24;

    if (samples.length < 2) {
        return <svg height={H} width={W} />;
    }

    const step = W / (samples.length - 1);
    const points = samples.map((fps, i) => `${(i * step).toFixed(1)},${(H - (fps / 60) * H).toFixed(1)}`).join(" ");

    return (
        <svg height={H} style="overflow:visible" width={W}>
            <polyline fill="none" points={points} stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>
    );
};

// ─── Memory mini-bar ─────────────────────────────────────────────────────────

const MiniMemoryBar = ({ memory }: { memory: MemoryInfo }): ComponentChildren => {
    const usedPct = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    const barColorMid = usedPct > 50 ? "bg-warning" : "bg-success";
    const barColor = usedPct > 80 ? "bg-destructive" : barColorMid;

    return (
        <div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                <div class={clsx("h-full rounded-full", barColor)} style={{ width: `${usedPct}%` }} />
            </div>
            <span class="text-[0.65rem] tabular-nums text-muted-foreground shrink-0">
                {formatBytes(memory.usedJSHeapSize)} / {formatBytes(memory.jsHeapSizeLimit)}
            </span>
        </div>
    );
};

// ─── Max history kept in tooltip sparkline ────────────────────────────────────

const MAX_FPS_HISTORY = 60;

// ─── Main tooltip component ──────────────────────────────────────────────────

const PerformanceTooltip = (_props: AppTooltipProps): ComponentChildren => {
    const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(() => performanceMonitor.getSnapshot());
    const fpsHistoryRef = useRef<number[]>([]);

    useEffect(() => {
        performanceMonitor.start();

        const unsubscribe = performanceMonitor.subscribe((next) => {
            fpsHistoryRef.current.push(next.fps);

            if (fpsHistoryRef.current.length > MAX_FPS_HISTORY) {
                fpsHistoryRef.current.shift();
            }

            setSnapshot(next);
        });

        return unsubscribe;
    }, []);

    const { fps, memory, vitals } = snapshot;
    const fpsMidRating: CwvRating = fps >= 30 ? "needs-improvement" : "poor";
    const fpsRating: CwvRating = fps >= 50 ? "good" : fpsMidRating;

    return (
        <div class="space-y-3 min-w-[200px]">
            {/* FPS row */}
            <div class="flex items-end gap-3">
                {/* Large FPS counter */}
                <div class="flex flex-col items-center gap-0 shrink-0">
                    <span class={clsx("text-2xl font-bold tabular-nums leading-none", RATING_CLASSES[fpsRating])}>{fps}</span>
                    <span class="text-[0.55rem] text-muted-foreground uppercase tracking-wide">fps</span>
                </div>
                {/* Sparkline */}
                <div class={clsx("flex-1 min-w-0", RATING_CLASSES[fpsRating])}>
                    <MiniSparkline samples={fpsHistoryRef.current} />
                </div>
            </div>

            {/* LCP + CLS row */}
            <div class="flex gap-3">
                {vitals.lcp !== undefined && (
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[0.55rem] text-muted-foreground uppercase tracking-wide">LCP</span>
                        <span class={clsx("text-[0.8rem] font-semibold tabular-nums", RATING_CLASSES[getCwvRating("lcp", vitals.lcp)])}>{vitals.lcp} ms</span>
                    </div>
                )}
                {vitals.fcp !== undefined && (
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[0.55rem] text-muted-foreground uppercase tracking-wide">FCP</span>
                        <span class={clsx("text-[0.8rem] font-semibold tabular-nums", RATING_CLASSES[getCwvRating("fcp", vitals.fcp)])}>{vitals.fcp} ms</span>
                    </div>
                )}
                {vitals.cls !== undefined && (
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[0.55rem] text-muted-foreground uppercase tracking-wide">CLS</span>
                        <span class={clsx("text-[0.8rem] font-semibold tabular-nums", RATING_CLASSES[getCwvRating("cls", vitals.cls)])}>
                            {vitals.cls.toFixed(3)}
                        </span>
                    </div>
                )}
                {vitals.lcp === undefined && vitals.fcp === undefined && vitals.cls === undefined && (
                    <span class="text-[0.65rem] text-muted-foreground/50">Collecting metrics…</span>
                )}
            </div>

            {/* Memory bar */}
            {memory && (
                <div>
                    <span class="text-[0.55rem] text-muted-foreground uppercase tracking-wide block mb-1">Heap</span>
                    <MiniMemoryBar memory={memory} />
                </div>
            )}
        </div>
    );
};

export default PerformanceTooltip;
