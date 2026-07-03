import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { CWV_THRESHOLDS, getCwvRating, PerformanceMonitor } from "../../src/performance/monitor";

describe("cWV_THRESHOLDS", () => {
    it("defines thresholds for all five core web vitals", () => {
        expect.hasAssertions();

        expect(CWV_THRESHOLDS).toHaveProperty("lcp");
        expect(CWV_THRESHOLDS).toHaveProperty("cls");
        expect(CWV_THRESHOLDS).toHaveProperty("fid");
        expect(CWV_THRESHOLDS).toHaveProperty("fcp");
        expect(CWV_THRESHOLDS).toHaveProperty("ttfb");
    });

    it("each vital has good and poor thresholds", () => {
        expect.hasAssertions();

        for (const vital of Object.values(CWV_THRESHOLDS)) {
            expect(vital).toHaveProperty("good");
            expect(vital).toHaveProperty("poor");
        }
    });

    it("good threshold is always less than poor threshold", () => {
        expect.hasAssertions();

        for (const { good, poor } of Object.values(CWV_THRESHOLDS)) {
            expect(good).toBeLessThan(poor);
        }
    });

    it("has correct LCP thresholds (2500ms good, 4000ms poor)", () => {
        expect.hasAssertions();

        expect(CWV_THRESHOLDS.lcp.good).toBe(2500);
        expect(CWV_THRESHOLDS.lcp.poor).toBe(4000);
    });

    it("has correct CLS thresholds (0.1 good, 0.25 poor)", () => {
        expect.hasAssertions();

        expect(CWV_THRESHOLDS.cls.good).toBe(0.1);
        expect(CWV_THRESHOLDS.cls.poor).toBe(0.25);
    });

    it("has correct FID thresholds (100ms good, 300ms poor)", () => {
        expect.hasAssertions();

        expect(CWV_THRESHOLDS.fid.good).toBe(100);
        expect(CWV_THRESHOLDS.fid.poor).toBe(300);
    });
});

describe(getCwvRating, () => {
    describe("lcp", () => {
        it("rates value at or below good threshold as 'good'", () => {
            expect.hasAssertions();

            expect(getCwvRating("lcp", 2500)).toBe("good");
            expect(getCwvRating("lcp", 0)).toBe("good");
        });

        it("rates value between good and poor as 'needs-improvement'", () => {
            expect.hasAssertions();

            expect(getCwvRating("lcp", 2501)).toBe("needs-improvement");
            expect(getCwvRating("lcp", 3000)).toBe("needs-improvement");
            expect(getCwvRating("lcp", 4000)).toBe("needs-improvement");
        });

        it("rates value above poor threshold as 'poor'", () => {
            expect.hasAssertions();

            expect(getCwvRating("lcp", 4001)).toBe("poor");
            expect(getCwvRating("lcp", 10_000)).toBe("poor");
        });
    });

    describe("cls", () => {
        it("rates value at or below 0.1 as 'good'", () => {
            expect.hasAssertions();

            expect(getCwvRating("cls", 0.1)).toBe("good");
            expect(getCwvRating("cls", 0)).toBe("good");
        });

        it("rates value between 0.1 and 0.25 as 'needs-improvement'", () => {
            expect.hasAssertions();

            expect(getCwvRating("cls", 0.15)).toBe("needs-improvement");
            expect(getCwvRating("cls", 0.25)).toBe("needs-improvement");
        });

        it("rates value above 0.25 as 'poor'", () => {
            expect.hasAssertions();

            expect(getCwvRating("cls", 0.26)).toBe("poor");
        });
    });

    describe("fid", () => {
        it("rates value at or below 100ms as 'good'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fid", 100)).toBe("good");
        });

        it("rates value between 100ms and 300ms as 'needs-improvement'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fid", 200)).toBe("needs-improvement");
            expect(getCwvRating("fid", 300)).toBe("needs-improvement");
        });

        it("rates value above 300ms as 'poor'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fid", 301)).toBe("poor");
        });
    });

    describe("fcp", () => {
        it("rates value at or below 1800ms as 'good'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fcp", 1800)).toBe("good");
        });

        it("rates value between 1800ms and 3000ms as 'needs-improvement'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fcp", 2500)).toBe("needs-improvement");
        });

        it("rates value above 3000ms as 'poor'", () => {
            expect.hasAssertions();

            expect(getCwvRating("fcp", 3001)).toBe("poor");
        });
    });

    describe("ttfb", () => {
        it("rates value at or below 800ms as 'good'", () => {
            expect.hasAssertions();

            expect(getCwvRating("ttfb", 800)).toBe("good");
        });

        it("rates value between 800ms and 1800ms as 'needs-improvement'", () => {
            expect.hasAssertions();

            expect(getCwvRating("ttfb", 1200)).toBe("needs-improvement");
        });

        it("rates value above 1800ms as 'poor'", () => {
            expect.hasAssertions();

            expect(getCwvRating("ttfb", 1801)).toBe("poor");
        });
    });
});

describe("performanceMonitor", () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        monitor = new PerformanceMonitor();
    });

    afterEach(() => {
        monitor.stop();
    });

    describe("getSnapshot", () => {
        it("returns a snapshot with the expected shape", () => {
            expect.hasAssertions();

            const snapshot = monitor.getSnapshot();

            expect(snapshot).toHaveProperty("fps");
            expect(snapshot).toHaveProperty("longTasks");
            expect(snapshot).toHaveProperty("memory");
            expect(snapshot).toHaveProperty("vitals");
        });

        it("returns fps of 0 when no frames have been recorded", () => {
            expect.hasAssertions();

            expect(monitor.getSnapshot().fps).toBe(0);
        });

        it("returns undefined memory when not in a Chrome-like environment", () => {
            expect.hasAssertions();

            expect(monitor.getSnapshot().memory).toBeUndefined();
        });

        it("returns empty longTasks array initially", () => {
            expect.hasAssertions();

            expect(monitor.getSnapshot().longTasks).toHaveLength(0);
        });

        it("returns vitals with all undefined values initially", () => {
            expect.hasAssertions();

            const { vitals } = monitor.getSnapshot();

            expect(vitals.lcp).toBeUndefined();
            expect(vitals.cls).toBeUndefined();
            expect(vitals.fid).toBeUndefined();
            expect(vitals.fcp).toBeUndefined();
            expect(vitals.ttfb).toBeUndefined();
        });

        it("returns a copy of longTasks (not internal reference)", () => {
            expect.hasAssertions();

            const s1 = monitor.getSnapshot();
            const s2 = monitor.getSnapshot();

            expect(s1.longTasks).not.toBe(s2.longTasks);
        });

        it("returns a copy of vitals (not internal reference)", () => {
            expect.hasAssertions();

            const s1 = monitor.getSnapshot();
            const s2 = monitor.getSnapshot();

            expect(s1.vitals).not.toBe(s2.vitals);
        });
    });

    describe("subscribe / unsubscribe", () => {
        it("subscribe returns an unsubscribe function", () => {
            expect.hasAssertions();

            const unsub = monitor.subscribe(vi.fn());

            expect(unsub).toBeTypeOf("function");

            expectTypeOf(unsub).toBeFunction();
        });

        it("listener is called when clearLongTasks emits", () => {
            expect.hasAssertions();

            const listener = vi.fn();

            monitor.subscribe(listener);
            monitor.clearLongTasks();

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it("listener receives a snapshot when called", () => {
            expect.hasAssertions();

            const listener = vi.fn();

            monitor.subscribe(listener);
            monitor.clearLongTasks();

            const [snapshot] = listener.mock.calls[0] as [ReturnType<PerformanceMonitor["getSnapshot"]>];

            expect(snapshot).toHaveProperty("fps");
            expect(snapshot).toHaveProperty("longTasks");
        });

        it("unsubscribed listener is not called on subsequent emits", () => {
            expect.hasAssertions();

            const listener = vi.fn();
            const unsub = monitor.subscribe(listener);

            unsub();
            monitor.clearLongTasks();

            expect(listener).not.toHaveBeenCalled();
        });

        it("multiple listeners are all called", () => {
            expect.hasAssertions();

            const l1 = vi.fn();
            const l2 = vi.fn();

            monitor.subscribe(l1);
            monitor.subscribe(l2);
            monitor.clearLongTasks();

            expect(l1).toHaveBeenCalledTimes(1);
            expect(l2).toHaveBeenCalledTimes(1);
        });

        it("unsubscribing one listener does not affect others", () => {
            expect.hasAssertions();

            const l1 = vi.fn();
            const l2 = vi.fn();
            const unsub = monitor.subscribe(l1);

            monitor.subscribe(l2);
            unsub();
            monitor.clearLongTasks();

            expect(l1).not.toHaveBeenCalled();
            expect(l2).toHaveBeenCalledTimes(1);
        });
    });

    describe("clearLongTasks", () => {
        it("does not throw even when there are no long tasks", () => {
            expect.hasAssertions();

            expect(() => {
                monitor.clearLongTasks();
            }).not.toThrow();
        });

        it("results in an empty longTasks array in the snapshot", () => {
            expect.hasAssertions();

            monitor.clearLongTasks();

            expect(monitor.getSnapshot().longTasks).toHaveLength(0);
        });

        it("emits to all subscribed listeners", () => {
            expect.hasAssertions();

            const listener = vi.fn();

            monitor.subscribe(listener);
            monitor.clearLongTasks();

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe("start / stop (node environment — window is undefined)", () => {
        it("start() is safe to call when window is undefined (no-op in node)", () => {
            expect.hasAssertions();

            expect(() => {
                monitor.start();
            }).not.toThrow();
        });

        it("stop() is safe to call before start()", () => {
            expect.hasAssertions();

            expect(() => {
                monitor.stop();
            }).not.toThrow();
        });

        it("start() can be called multiple times without error", () => {
            expect.hasAssertions();

            expect(() => {
                monitor.start();
                monitor.start();
            }).not.toThrow();
        });

        it("stop() after start() does not throw", () => {
            expect.hasAssertions();

            monitor.start();

            expect(() => {
                monitor.stop();
            }).not.toThrow();
        });
    });
});
