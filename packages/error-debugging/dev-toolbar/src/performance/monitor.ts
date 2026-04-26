/**
 * Performance Monitor — singleton that collects browser performance metrics.
 *
 * Metrics collected:
 * - FPS via requestAnimationFrame circular buffer (last 60 samples)
 * - Memory via performance.memory (Chrome only, 1-second polling)
 * - Core Web Vitals: LCP, CLS, FID, FCP, TTFB (PerformanceObserver, buffered)
 * - Long tasks (>50 ms blocking) via PerformanceObserver
 */

interface MemoryInfo {
    /** JS heap size limit in bytes */
    jsHeapSizeLimit: number;
    /** Total allocated JS heap in bytes */
    totalJSHeapSize: number;
    /** Currently used JS heap in bytes */
    usedJSHeapSize: number;
}

interface LongTask {
    /** Duration in milliseconds */
    duration: number;
    /** Unique id */
    id: string;
    /** Start time (DOMHighResTimeStamp) */
    startTime: number;
}

interface CoreWebVitals {
    /** Cumulative Layout Shift score */
    cls: number | undefined;
    /** First Contentful Paint in ms */
    fcp: number | undefined;
    /** First Input Delay in ms */
    fid: number | undefined;
    /** Largest Contentful Paint in ms */
    lcp: number | undefined;
    /** Time to First Byte in ms */
    ttfb: number | undefined;
}

interface PerformanceSnapshot {
    /** Current FPS (0–60) */
    fps: number;
    /** Long tasks captured since start */
    longTasks: LongTask[];
    /** Memory info (Chrome only, otherwise undefined) */
    memory: MemoryInfo | undefined;
    /** Core Web Vitals */
    vitals: CoreWebVitals;
}

type Listener = (snapshot: PerformanceSnapshot) => void;

// How many rAF timestamps to keep for FPS calculation
const FPS_BUFFER_SIZE = 60;

// Thresholds (ms) for CWV ratings
const CWV_THRESHOLDS = {
    cls: { good: 0.1, poor: 0.25 },
    fcp: { good: 1800, poor: 3000 },
    fid: { good: 100, poor: 300 },
    lcp: { good: 2500, poor: 4000 },
    ttfb: { good: 800, poor: 1800 },
} as const;

type CwvRating = "good" | "needs-improvement" | "poor";

const getCwvRating = (metric: keyof typeof CWV_THRESHOLDS, value: number): CwvRating => {
    const { good, poor } = CWV_THRESHOLDS[metric];

    if (value <= good) {
        return "good";
    }

    if (value <= poor) {
        return "needs-improvement";
    }

    return "poor";
};

class PerformanceMonitor {
    private clsValue = 0;

    private fpsSamples: number[] = [];

    private listeners = new Set<Listener>();

    private longTaskIdCounter = 0;

    private longTasks: LongTask[] = [];

    private memory: MemoryInfo | undefined = undefined;

    private memoryInterval: ReturnType<typeof setInterval> | undefined = undefined;

    private observers: PerformanceObserver[] = [];

    private rafId: number | undefined = undefined;

    private running = false;

    private vitals: CoreWebVitals = {
        cls: undefined,
        fcp: undefined,
        fid: undefined,
        lcp: undefined,
        ttfb: undefined,
    };

    /**
     * Removes all collected long tasks (useful for the "Clear" button in the UI).
     */
    public clearLongTasks(): void {
        this.longTasks = [];
        this.emit();
    }

    /**
     * Returns a snapshot of the current metrics (no subscription).
     */
    public getSnapshot(): PerformanceSnapshot {
        return {
            fps: this.currentFps(),
            longTasks: [...this.longTasks],
            memory: this.memory,
            vitals: { ...this.vitals },
        };
    }

    /**
     * Starts collecting metrics. Safe to call multiple times — starts once.
     */
    public start(): void {
        if (this.running || globalThis.window === undefined) {
            return;
        }

        this.running = true;

        this.startFps();
        this.startMemory();
        this.startCwv();
        this.startLongTasks();
        this.loadTtfb();
    }

    /**
     * Stops all observers and timers.
     */
    public stop(): void {
        if (!this.running) {
            return;
        }

        this.running = false;

        if (this.rafId !== undefined) {
            cancelAnimationFrame(this.rafId);
            this.rafId = undefined;
        }

        if (this.memoryInterval !== undefined) {
            clearInterval(this.memoryInterval);
            this.memoryInterval = undefined;
        }

        for (const observer of this.observers) {
            observer.disconnect();
        }

        this.observers = [];
    }

    /**
     * Subscribes to metric updates. Returns an unsubscribe function.
     */
    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private currentFps(): number {
        if (this.fpsSamples.length < 2) {
            return 0;
        }

        const samples = this.fpsSamples.slice(-Math.min(this.fpsSamples.length, 10));

        if (samples.length < 2) {
            return 0;
        }

        // Average frame time over last ~10 frames
        let totalDelta = 0;
        let count = 0;

        for (let i = 1; i < samples.length; i += 1) {
            const delta = samples[i]! - samples[i - 1]!;

            if (delta > 0 && delta < 500) {
                totalDelta += delta;
                count += 1;
            }
        }

        if (count === 0) {
            return 0;
        }

        return Math.min(60, Math.round(1000 / (totalDelta / count)));
    }

    private emit(): void {
        const snapshot = this.getSnapshot();

        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    private loadTtfb(): void {
        // Try from NavigationTiming (already available at page load)
        const entries = performance.getEntriesByType("navigation");

        if (entries.length > 0 && entries[0]) {
            const navEntry = entries[0] as PerformanceEntry & {
                requestStart: number;
                responseStart: number;
            };

            this.vitals.ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
            this.emit();
        }
    }

    private startCwv(): void {
        // LCP
        this.tryObserve("largest-contentful-paint", (list) => {
            const entries = list.getEntries();
            const last = entries.at(-1) as PerformanceEntry & { startTime: number };

            if (last) {
                this.vitals.lcp = Math.round(last.startTime);
                this.emit();
            }
        });

        // CLS — cumulative
        this.tryObserve("layout-shift", (list) => {
            for (const entry of list.getEntries()) {
                const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };

                if (!ls.hadRecentInput) {
                    this.clsValue += ls.value;
                    this.vitals.cls = Math.round(this.clsValue * 1000) / 1000;
                }
            }

            this.emit();
        });

        // FID
        this.tryObserve("first-input", (list) => {
            const entry = list.getEntries()[0] as PerformanceEntry & { processingStart: number; startTime: number };

            if (entry) {
                this.vitals.fid = Math.round(entry.processingStart - entry.startTime);
                this.emit();
            }
        });

        // FCP
        this.tryObserve("paint", (list) => {
            for (const entry of list.getEntries()) {
                if (entry.name === "first-contentful-paint") {
                    this.vitals.fcp = Math.round(entry.startTime);
                    this.emit();
                }
            }
        });
    }

    private startFps(): void {
        let lastTime: number | undefined;

        const tick = (timestamp: number): void => {
            if (!this.running) {
                return;
            }

            if (lastTime !== undefined) {
                this.fpsSamples.push(timestamp);

                if (this.fpsSamples.length > FPS_BUFFER_SIZE) {
                    this.fpsSamples.shift();
                }

                // Emit every ~16 frames (~250 ms at 60 fps)
                if (this.fpsSamples.length % 16 === 0) {
                    this.emit();
                }
            }

            lastTime = timestamp;
            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    private startLongTasks(): void {
        this.tryObserve("longtask", (list) => {
            for (const entry of list.getEntries()) {
                this.longTaskIdCounter += 1;
                this.longTasks.push({
                    duration: Math.round(entry.duration),
                    id: `lt-${this.longTaskIdCounter}`,
                    startTime: Math.round(entry.startTime),
                });

                // Keep only the last 100 long tasks
                if (this.longTasks.length > 100) {
                    this.longTasks.shift();
                }
            }

            this.emit();
        });
    }

    private startMemory(): void {
        const perf = performance as Performance & { memory?: MemoryInfo };

        if (!perf.memory) {
            return;
        }

        const read = (): void => {
            if (perf.memory) {
                this.memory = {
                    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
                    totalJSHeapSize: perf.memory.totalJSHeapSize,
                    usedJSHeapSize: perf.memory.usedJSHeapSize,
                };
                this.emit();
            }
        };

        read();
        this.memoryInterval = setInterval(read, 1000);
    }

    private tryObserve(type: string, callback: (list: PerformanceObserverEntryList) => void): void {
        try {
            const observer = new PerformanceObserver(callback);

            observer.observe({ buffered: true, type });
            this.observers.push(observer);
        } catch {
            // Entry type not supported in this browser — silently skip
        }
    }
}

// Module-level singleton — shared across all component instances
const performanceMonitor: PerformanceMonitor = new PerformanceMonitor();

export type { CoreWebVitals, CwvRating, LongTask, MemoryInfo, PerformanceSnapshot };
export { CWV_THRESHOLDS, getCwvRating, PerformanceMonitor, performanceMonitor };
