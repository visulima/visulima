/**
 * Performance Monitor — singleton that collects browser performance metrics.
 *
 * Metrics collected:
 *  - FPS via requestAnimationFrame circular buffer (last 60 samples)
 *  - Memory via performance.memory (Chrome only, 1-second polling)
 *  - Core Web Vitals: LCP, CLS, FID, FCP, TTFB (PerformanceObserver, buffered)
 *  - Long tasks (>50 ms blocking) via PerformanceObserver
 */

export interface MemoryInfo {
    /** JS heap size limit in bytes */
    jsHeapSizeLimit: number;
    /** Total allocated JS heap in bytes */
    totalJSHeapSize: number;
    /** Currently used JS heap in bytes */
    usedJSHeapSize: number;
}

export interface LongTask {
    /** Duration in milliseconds */
    duration: number;
    /** Unique id */
    id: string;
    /** Start time (DOMHighResTimeStamp) */
    startTime: number;
}

export interface CoreWebVitals {
    /** Cumulative Layout Shift score */
    cls: null | number;
    /** First Contentful Paint in ms */
    fcp: null | number;
    /** First Input Delay in ms */
    fid: null | number;
    /** Largest Contentful Paint in ms */
    lcp: null | number;
    /** Time to First Byte in ms */
    ttfb: null | number;
}

export interface PerformanceSnapshot {
    /** Current FPS (0–60) */
    fps: number;
    /** Long tasks captured since start */
    longTasks: LongTask[];
    /** Memory info (Chrome only, otherwise null) */
    memory: MemoryInfo | null;
    /** Core Web Vitals */
    vitals: CoreWebVitals;
}

type Listener = (snapshot: PerformanceSnapshot) => void;

// How many rAF timestamps to keep for FPS calculation
const FPS_BUFFER_SIZE = 60;

// Thresholds (ms) for CWV ratings
export const CWV_THRESHOLDS = {
    cls: { good: 0.1, poor: 0.25 },
    fcp: { good: 1800, poor: 3000 },
    fid: { good: 100, poor: 300 },
    lcp: { good: 2500, poor: 4000 },
    ttfb: { good: 800, poor: 1800 },
} as const;

export type CwvRating = "good" | "needs-improvement" | "poor";

export const getCwvRating = (metric: keyof typeof CWV_THRESHOLDS, value: number): CwvRating => {
    const { good, poor } = CWV_THRESHOLDS[metric];

    if (value <= good) {
        return "good";
    }

    if (value <= poor) {
        return "needs-improvement";
    }

    return "poor";
};

export class PerformanceMonitor {
    private clsValue = 0;

    private fpsSamples: number[] = [];

    private listeners = new Set<Listener>();

    private longTaskIdCounter = 0;

    private longTasks: LongTask[] = [];

    private memory: MemoryInfo | null = null;

    private memoryInterval: ReturnType<typeof setInterval> | null = null;

    private observers: PerformanceObserver[] = [];

    private rafId: number | null = null;

    private running = false;

    private vitals: CoreWebVitals = {
        cls: null,
        fcp: null,
        fid: null,
        lcp: null,
        ttfb: null,
    };

    /**
     * Remove all collected long tasks (useful for the "Clear" button in the UI).
     */
    clearLongTasks(): void {
        this.longTasks = [];
        this.emit();
    }

    /**
     * Return a snapshot of the current metrics (no subscription).
     */
    getSnapshot(): PerformanceSnapshot {
        return {
            fps: this.currentFps(),
            longTasks: [...this.longTasks],
            memory: this.memory,
            vitals: { ...this.vitals },
        };
    }

    /**
     * Start collecting metrics. Safe to call multiple times — starts once.
     */
    start(): void {
        if (this.running || typeof window === "undefined") {
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
     * Stop all observers and timers.
     */
    stop(): void {
        if (!this.running) {
            return;
        }

        this.running = false;

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.memoryInterval !== null) {
            clearInterval(this.memoryInterval);
            this.memoryInterval = null;
        }

        for (const observer of this.observers) {
            observer.disconnect();
        }

        this.observers = [];
    }

    /**
     * Subscribe to metric updates. Returns an unsubscribe function.
     */
    subscribe(listener: Listener): () => void {
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

        for (let i = 1; i < samples.length; i++) {
            const delta = samples[i]! - samples[i - 1]!;

            if (delta > 0 && delta < 500) {
                totalDelta += delta;
                count++;
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
        const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];

        if (entries.length > 0 && entries[0]) {
            this.vitals.ttfb = Math.round(entries[0].responseStart - entries[0].requestStart);
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
        let lastTime: number | null = null;

        const tick = (timestamp: number): void => {
            if (!this.running) {
                return;
            }

            if (lastTime !== null) {
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
                this.longTaskIdCounter++;
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
export const performanceMonitor: PerformanceMonitor = new PerformanceMonitor();
