/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { CoreWebVitals, CwvRating, LongTask, MemoryInfo, PerformanceSnapshot } from "../../performance/monitor";
import { getCwvRating, performanceMonitor } from "../../performance/monitor";
import type { AppComponentProps } from "../../types/app";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMs = (ms: number): string => `${ms} ms`;

const RATING_CLASSES: Record<CwvRating, string> = {
    good: "text-success-foreground",
    "needs-improvement": "text-warning-foreground",
    poor: "text-destructive",
};

const RATING_BG: Record<CwvRating, string> = {
    good: "bg-success/10 border-success/30",
    "needs-improvement": "bg-warning/10 border-warning/30",
    poor: "bg-destructive/10 border-destructive/30",
};

// ─── FPS Sparkline (SVG polyline, last 60 samples) ──────────────────────────

const FpsSparkline = ({ samples }: { samples: number[] }): ComponentChildren => {
    const W = 120;
    const H = 36;
    const maxFps = 60;

    if (samples.length < 2) {
        return <svg height={H} width={W} />;
    }

    const step = W / (samples.length - 1);
    const points = samples
        .map((fps, i) => {
            const x = i * step;
            const y = H - (fps / maxFps) * H;

            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    return (
        <svg height={H} style="overflow: visible" width={W}>
            <polyline fill="none" points={points} stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
        </svg>
    );
};

// ─── Memory bar ─────────────────────────────────────────────────────────────

const MemoryBar = ({ memory }: { memory: MemoryInfo }): ComponentChildren => {
    const usedPct = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    const totalPct = (memory.totalJSHeapSize / memory.jsHeapSizeLimit) * 100;

    const barColorHighWarning = usedPct > 50 ? "bg-warning" : "bg-success";
    const barColor = usedPct > 80 ? "bg-destructive" : barColorHighWarning;

    return (
        <div class="space-y-1.5">
            {/* Track */}
            <div class="relative h-2 bg-foreground/8 rounded-full overflow-hidden">
                {/* Total allocated */}
                <div class="absolute left-0 top-0 h-full bg-foreground/12 rounded-full" style={{ width: `${totalPct}%` }} />
                {/* Used */}
                <div class={clsx("absolute left-0 top-0 h-full rounded-full", barColor)} style={{ width: `${usedPct}%` }} />
            </div>
            {/* Labels */}
            <div class="flex justify-between text-[0.65rem] text-muted-foreground">
                <span>
                    Used: <span class="text-foreground font-medium">{formatBytes(memory.usedJSHeapSize)}</span>
                </span>
                <span>
                    Total: <span class="text-foreground font-medium">{formatBytes(memory.totalJSHeapSize)}</span>
                </span>
                <span>
                    Limit: <span class="text-foreground font-medium">{formatBytes(memory.jsHeapSizeLimit)}</span>
                </span>
            </div>
        </div>
    );
};

// ─── CWV card ────────────────────────────────────────────────────────────────

interface CwvMetric {
    label: string;
    metric: keyof CoreWebVitals;
    unit: string;
    value: number | undefined;
}

const CwvCard = ({ label, metric, unit, value }: CwvMetric): ComponentChildren => {
    if (value === undefined) {
        return (
            <div class="flex flex-col items-center gap-1 p-3 border border-border bg-foreground/2 min-w-0">
                <span class="text-[0.6rem] text-muted-foreground uppercase tracking-wider font-semibold truncate w-full text-center">{label}</span>
                <span class="text-[0.7rem] text-muted-foreground/50">—</span>
            </div>
        );
    }

    // CLS is a ratio, not milliseconds
    const rating = getCwvRating(metric, value);
    const display = metric === "cls" ? value.toFixed(3) : formatMs(value);

    return (
        <div class={clsx("flex flex-col items-center gap-1 p-3 border min-w-0", RATING_BG[rating])}>
            <span class="text-[0.6rem] text-muted-foreground uppercase tracking-wider font-semibold truncate w-full text-center">{label}</span>
            <span class={clsx("text-[0.9rem] font-bold tabular-nums", RATING_CLASSES[rating])}>{display}</span>
            <span class="text-[0.6rem] text-muted-foreground/70 uppercase tracking-wide">{unit}</span>
        </div>
    );
};

// ─── Long tasks list ─────────────────────────────────────────────────────────

const LongTaskRow = ({ task }: { task: LongTask }): ComponentChildren => (
    <div class="flex items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 text-[0.7rem]">
        <span class="text-muted-foreground tabular-nums w-20 shrink-0">{task.startTime.toLocaleString()} ms</span>
        <div class="flex-1 bg-foreground/6 rounded-sm overflow-hidden h-2">
            <div class="h-full bg-warning" style={{ width: `${Math.min(100, (task.duration / 200) * 100)}%` }} title={`${task.duration} ms`} />
        </div>
        <span class="text-warning-foreground font-semibold tabular-nums w-16 text-right shrink-0">{task.duration} ms</span>
    </div>
);

// ─── Section wrapper ─────────────────────────────────────────────────────────

const Section = ({ action, children, title }: { action?: ComponentChildren; children: ComponentChildren; title: string }): ComponentChildren => (
    <section class="border border-border">
        <div class="flex items-center justify-between px-4 py-2.5 bg-foreground/3 border-b border-border">
            <span class="text-[0.7rem] font-semibold text-foreground uppercase tracking-wide">{title}</span>
            {action}
        </div>
        <div class="p-4">{children}</div>
    </section>
);

// ─── FPS history — keep last 120 values for sparkline ────────────────────────

const MAX_FPS_HISTORY = 120;

// ─── Main component ──────────────────────────────────────────────────────────

const PerformanceApp = (_props: AppComponentProps): ComponentChildren => {
    const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(() => performanceMonitor.getSnapshot());
    const fpsHistoryRef = useRef<number[]>([]);

    useEffect(() => {
        performanceMonitor.start();

        const unsubscribe = performanceMonitor.subscribe((next) => {
            // Append current FPS to rolling history
            fpsHistoryRef.current.push(next.fps);

            if (fpsHistoryRef.current.length > MAX_FPS_HISTORY) {
                fpsHistoryRef.current.shift();
            }

            setSnapshot(next);
        });

        return unsubscribe;
    }, []);

    const { fps, longTasks, memory, vitals } = snapshot;
    const fpsMidRating: CwvRating = fps >= 30 ? "needs-improvement" : "poor";
    const fpsRating: CwvRating = fps >= 50 ? "good" : fpsMidRating;

    const cwvMetrics: CwvMetric[] = [
        { label: "LCP", metric: "lcp", unit: "ms", value: vitals.lcp },
        { label: "FID", metric: "fid", unit: "ms", value: vitals.fid },
        { label: "CLS", metric: "cls", unit: "score", value: vitals.cls },
        { label: "FCP", metric: "fcp", unit: "ms", value: vitals.fcp },
        { label: "TTFB", metric: "ttfb", unit: "ms", value: vitals.ttfb },
    ];

    return (
        <div class="p-5 space-y-4">
            {/* FPS */}
            <Section title="FPS">
                <div class="flex items-end gap-5">
                    {/* Current FPS badge */}
                    <div class="flex flex-col items-center gap-0.5 shrink-0">
                        <span class={clsx("text-3xl font-bold tabular-nums leading-none", RATING_CLASSES[fpsRating])}>{fps}</span>
                        <span class="text-[0.6rem] text-muted-foreground uppercase tracking-wide">fps</span>
                    </div>
                    {/* Sparkline */}
                    <div class={clsx("flex-1 min-w-0", RATING_CLASSES[fpsRating])}>
                        <FpsSparkline samples={fpsHistoryRef.current} />
                    </div>
                    {/* FPS bar scale labels */}
                    <div class="flex flex-col justify-between h-9 text-[0.6rem] text-muted-foreground/50 shrink-0 tabular-nums">
                        <span>60</span>
                        <span>30</span>
                        <span>0</span>
                    </div>
                </div>
            </Section>

            {/* Memory */}
            {memory ? (
                <Section title="JS Heap Memory">
                    <MemoryBar memory={memory} />
                </Section>
            ) : (
                <Section title="JS Heap Memory">
                    <p class="text-[0.72rem] text-muted-foreground text-center py-2">
                        Not available — enable <code class="font-mono text-foreground/70">--enable-precise-memory-info</code> in Chrome flags.
                    </p>
                </Section>
            )}

            {/* Core Web Vitals */}
            <Section title="Core Web Vitals">
                <div class="grid grid-cols-3 gap-2">
                    {cwvMetrics.map((m) => (
                        <CwvCard key={m.metric} label={m.label} metric={m.metric} unit={m.unit} value={m.value} />
                    ))}
                </div>
                <p class="mt-2 text-[0.62rem] text-muted-foreground/60">
                    Measured from page load. Reload to refresh. LCP and FID update as the page is interacted with.
                </p>
            </Section>

            {/* Long Tasks */}
            <Section
                action={
                    longTasks.length > 0 ? (
                        <button
                            class="px-2 py-0.5 text-[0.65rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent transition-colors"
                            onClick={() => {
                                performanceMonitor.clearLongTasks();
                            }}
                            type="button"
                        >
                            Clear
                        </button>
                    ) : undefined
                }
                title={`Long Tasks${longTasks.length > 0 ? ` (${longTasks.length})` : ""}`}
            >
                {longTasks.length === 0 ? (
                    <p class="text-[0.72rem] text-muted-foreground text-center py-2">No long tasks detected yet.</p>
                ) : (
                    <div class="max-h-48 overflow-y-auto devtools-content-scroll">
                        {longTasks.map((task) => (
                            <LongTaskRow key={task.id} task={task} />
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
};

export default PerformanceApp;
