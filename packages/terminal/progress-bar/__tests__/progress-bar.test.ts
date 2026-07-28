import type { InteractiveManager } from "@visulima/interactive-manager";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProgressBar } from "../src/progress-bar";
import type { ProgressBarOptions } from "../src/types";
import { applyStyleToOptions, getBarChar } from "../src/utils";

/**
 * Very small stub of `InteractiveManager` so we can exercise the
 * hook/unhook code paths without touching real terminal streams.
 */
const createManagerStub = (): {
    manager: InteractiveManager;
    state: { hookCalls: number; unhookCalls: number; updates: string[][] };
} => {
    const state = { hookCalls: 0, unhookCalls: 0, updates: [] as string[][] };

    const manager = {
        erase: vi.fn(),
        hook: vi.fn(() => {
            state.hookCalls += 1;

            return true;
        }),
        get isHooked() {
            return state.hookCalls > state.unhookCalls;
        },
        get isSuspended() {
            return false;
        },
        get lastLength() {
            return 0;
        },
        get outside() {
            return 0;
        },
        resume: vi.fn(),
        suspend: vi.fn(),
        unhook: vi.fn(() => {
            state.unhookCalls += 1;

            return true;
        }),
        update: vi.fn((_stream: string, rows: string[]) => {
            state.updates.push([...rows]);
        }),
    } as unknown as InteractiveManager;

    return { manager, state };
};

describe("progressBar", () => {
    describe("render", () => {
        it("should render a basic progress bar at 0%", () => {
            expect.assertions(2);

            const bar = new ProgressBar({ total: 100 });
            const output = bar.render();

            expect(output).toContain("0%");
            expect(output).toContain("0/100");
        });

        it("should render at 50%", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 50, total: 100 });
            const output = bar.render();

            expect(output).toContain("50%");
        });

        it("should render at 100%", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 100, total: 100 });
            const output = bar.render();

            expect(output).toContain("100%");
        });

        it("should use custom format", () => {
            expect.assertions(1);

            const bar = new ProgressBar({
                current: 25,
                format: "{percentage}% done",
                total: 100,
            });

            expect(bar.render()).toBe("25% done");
        });

        it("should replace payload placeholders", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 50, format: "{task} [{bar}] {percentage}%", total: 100 }, undefined, { task: "Building" });

            expect(bar.render()).toContain("Building");
        });
    });

    describe("update", () => {
        it("should update the current value", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ format: "{value}/{total}", total: 100 });

            bar.update(42);

            expect(bar.render()).toContain("42/100");
        });

        it("should clamp to total", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ format: "{value}/{total}", total: 100 });

            bar.update(200);

            expect(bar.render()).toContain("100/100");
        });
    });

    describe("increment", () => {
        it("should increment by 1 by default", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 0, format: "{value}", total: 100 });

            bar.increment();

            expect(bar.render()).toBe("1");
        });

        it("should increment by custom step", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 0, format: "{value}", total: 100 });

            bar.increment(10);

            expect(bar.render()).toBe("10");
        });
    });

    describe("styles", () => {
        it("should use shades_classic by default", () => {
            expect.assertions(2);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", total: 100, width: 10 });
            const output = bar.render();

            expect(output).toContain("█");
            expect(output).toContain("░");
        });

        it("should use ascii style", () => {
            expect.assertions(2);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", style: "ascii", total: 100, width: 10 });
            const output = bar.render();

            expect(output).toContain("#");
            expect(output).toContain("-");
        });
    });
});

describe("progressBar (extra coverage)", () => {
    describe("lifecycle", () => {
        it("should hook on start and unhook on stop", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ total: 100 }, manager);

            bar.start();
            bar.stop();

            expect(state.hookCalls).toBe(1);
            expect(state.unhookCalls).toBe(1);
        });

        it("should allow overriding total and startValue in start()", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}/{total}", total: 100 }, manager);

            bar.start(200, 50);

            const last = state.updates.at(-1);

            expect(last?.[0]).toContain("50/200");
            expect(state.hookCalls).toBe(1);
        });

        it("should call interactive manager update on update() when active", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", fps: 10, total: 100 }, manager);

            bar.start();
            state.updates.length = 0;
            // Live renders are throttled by fps; advance past one frame interval so
            // the update is flushed instead of coalesced.
            vi.setSystemTime(200);
            bar.update(42);

            vi.useRealTimers();

            expect(state.updates.at(-1)?.[0]).toBe("42");
        });

        it("should not throw when start() is called without a manager", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ format: "{value}/{total}", total: 100 });

            bar.start(200, 50);

            expect(bar.render()).toContain("50/200");
        });

        it("should not throw when stop() is called without a manager", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ total: 100 });

            bar.start();

            expect(() => {
                bar.stop();
            }).not.toThrow();
        });
    });

    describe("payload", () => {
        it("should merge incoming payload on update()", () => {
            expect.assertions(2);

            const bar = new ProgressBar({ format: "{task} {value}", total: 100 }, undefined, { task: "init" });

            expect(bar.render()).toContain("init");

            bar.update(10, { task: "build" });

            expect(bar.render()).toContain("build");
        });

        it("should merge the start() payload even without a manager", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ format: "{task} {value}", total: 100 });

            bar.start(100, 0, { task: "build" });

            expect(bar.render()).toContain("build");
        });
    });

    describe("peak marker", () => {
        it("should render peak character at the configured position", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 10, format: "[{bar}]", peak: 80, peakChar: "P", style: "ascii", total: 100, width: 10 });

            expect(bar.render()).toContain("P");
        });

        it("should set peak via setPeak", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 10, format: "[{bar}]", peakChar: "X", style: "ascii", total: 100, width: 10 });

            bar.setPeak(80);

            expect(bar.render()).toContain("X");
        });

        it("should ignore peak when <= 0", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 5, format: "[{bar}]", peak: 0, peakChar: "?", style: "ascii", total: 100, width: 10 });

            expect(bar.render()).not.toContain("?");
        });

        it("should clamp peak position to filled-1 when peak lags far behind progress", () => {
            expect.assertions(2);

            // current=90 => filled=9, peak=10 => peakPos≈1 which is < filled-1 (8),
            // so the peak marker is pulled forward to position filled-1.
            const bar = new ProgressBar({ current: 90, format: "[{bar}]", peak: 10, peakChar: "P", style: "ascii", total: 100, width: 10 });
            const output = bar.render();

            expect(output).toContain("P");
            // Peak sits at the trailing edge of the filled region, not near the start.
            expect(output).toBe("[########P-]");
        });
    });

    describe("gradient mode", () => {
        it("should render array bar chars without throwing", () => {
            expect.assertions(2);

            const bar = new ProgressBar({
                barCompleteChar: ["a", "b", "c", "d"],
                barIncompleteChar: ["."],
                current: 50,
                format: "[{bar}]",
                total: 100,
                width: 10,
            });

            const output = bar.render();

            expect(output).toContain("[");
            expect(output).toContain("]");
        });

        it("should render gradient with single-element array", () => {
            expect.assertions(1);

            const bar = new ProgressBar({
                barCompleteChar: ["#"],
                current: 50,
                format: "[{bar}]",
                total: 100,
                width: 10,
            });

            expect(bar.render()).toContain("#");
        });

        it("should normalize a string complete char into an array when only the incomplete char is an array", () => {
            expect.assertions(1);

            // Only barIncompleteChar is an array -> gradient mode; the string
            // barCompleteChar must be wrapped into a single-element array.
            const bar = new ProgressBar({
                barCompleteChar: "*",
                barIncompleteChar: [".", "_"],
                current: 50,
                format: "[{bar}]",
                total: 100,
                width: 10,
            });

            expect(bar.render()).toBe("[*****.....]");
        });

        it("should pick the gradient boundary character for the leading filled cell", () => {
            expect.assertions(1);

            // current=35/100 with width=10 and a 4-step gradient leaves a
            // fractional remainder, so the boundary cell uses an interior gradient char.
            const bar = new ProgressBar({
                barCompleteChar: ["a", "b", "c", "d"],
                barIncompleteChar: ".",
                current: 35,
                format: "[{bar}]",
                total: 100,
                width: 10,
            });

            expect(bar.render()).toBe("[dddb......]");
        });

        it("should render the peak marker in gradient mode", () => {
            expect.assertions(1);

            // peak=80 with width=10 places the marker at column 8; gradient mode must
            // honour peak/peakChar just like the non-gradient branch.
            const bar = new ProgressBar({
                barCompleteChar: ["a", "b", "c", "d"],
                barIncompleteChar: ".",
                current: 10,
                format: "[{bar}]",
                peak: 80,
                peakChar: "P",
                total: 100,
                width: 10,
            });

            expect(bar.render()).toBe("[d.......P.]");
        });
    });

    describe("rounded caps", () => {
        it("should apply braille caps when style=braille and width >= 2", () => {
            expect.assertions(2);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", style: "braille", total: 100, width: 10 });
            const output = bar.render();

            expect(output).toContain("⢾");
            expect(output).toContain("⡷");
        });

        it("should honour explicit roundedCaps=false to skip caps", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", roundedCaps: false, style: "braille", total: 100, width: 10 });

            expect(bar.render()).not.toContain("⢾");
        });
    });

    describe("edge cases", () => {
        it("should handle total=0 without dividing by zero", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ format: "{percentage}%", total: 0 });

            expect(() => bar.render()).not.toThrow();
        });

        it("should clamp width to non-negative", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", total: 100, width: -10 });

            expect(bar.render()).toBe("[]");
        });

        it("should fall back to current=0 when current is explicitly undefined", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: undefined, format: "{value}", total: 100 });

            expect(bar.render()).toBe("0");
        });

        it("should fall back to the default width when width is explicitly undefined", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 50, format: "[{bar}]", total: 100, width: undefined });

            // The default width is 40 => a 40-character bar between the brackets.
            expect(bar.render()).toHaveLength("[]".length + 40);
        });
    });

    describe("eta", () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it("should return 0 ETA before any progress has been made", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ current: 0, format: "{eta}", total: 100 });

            expect(bar.render()).toBe("0");
        });

        it("should compute a positive ETA once enough time has elapsed", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const bar = new ProgressBar({ current: 0, format: "{eta}", total: 100 });

            bar.start(100, 25);

            // 2s elapsed, 25 done => rate 12.5/s, remaining 75 => ETA round(6) = 6.
            vi.setSystemTime(2000);

            expect(bar.render()).toBe("6");
        });

        it("should format eta, duration and rate tokens", () => {
            expect.assertions(3);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const bar = new ProgressBar({ current: 0, format: "{eta_formatted}|{duration}|{rate}", total: 1000 });

            bar.start(1000, 0);

            // record a second sample so the sliding window has a rate
            vi.setSystemTime(10_000);
            bar.update(100);

            vi.setSystemTime(10_000);

            // 100 done in 10s => rate 10/s; remaining 900 => eta 90s => "1m30s"; duration 10s.
            expect(bar.render()).toContain("1m30s");
            expect(bar.render()).toContain("10s");
            expect(bar.render()).toContain("10");
        });
    });

    describe("fps throttling", () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it("should coalesce rapid updates and only render once within a frame", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", fps: 10, total: 100 }, manager);

            bar.start();
            state.updates.length = 0;

            // Advance one frame so the first update flushes, then two more in the same
            // frame must be coalesced => exactly one render.
            vi.setSystemTime(200);
            bar.update(1);
            bar.update(2);
            bar.update(3);

            expect(state.updates).toHaveLength(1);
        });

        it("should render every update when fps is 0 (disabled)", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", fps: 0, total: 100 }, manager);

            bar.start();
            state.updates.length = 0;

            bar.update(1);
            bar.update(2);
            bar.update(3);

            expect(state.updates).toHaveLength(3);
        });

        it("should always flush a final frame on stop()", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", fps: 10, total: 100 }, manager);

            bar.start();
            bar.update(1);
            bar.update(42); // throttled away
            bar.stop();

            expect(state.updates.at(-1)?.[0]).toBe("42");
        });
    });

    describe("formatBar", () => {
        it("should transform the rendered bar segment", () => {
            expect.assertions(1);

            const bar = new ProgressBar({
                current: 50,
                format: "[{bar}]",
                formatBar: (segment) => `<${segment}>`,
                style: "ascii",
                total: 100,
                width: 4,
            });

            expect(bar.render()).toBe("[<##-->]");
        });

        it("should pass live state to the formatBar callback", () => {
            expect.assertions(1);

            const bar = new ProgressBar({
                current: 25,
                format: "{bar}",
                formatBar: (_segment, state) => `${String(state.percentage)}-${String(state.value)}-${String(state.total)}`,
                style: "ascii",
                total: 100,
                width: 4,
            });

            expect(bar.render()).toBe("25-25-100");
        });
    });

    describe("stopOnComplete / clearOnComplete", () => {
        it("should auto-stop and unhook when value reaches total", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", stopOnComplete: true, total: 100 }, manager);

            bar.start();
            bar.update(100);

            expect(state.unhookCalls).toBe(1);
            expect(state.updates.at(-1)?.[0]).toBe("100");
        });

        it("should erase the bar on stop when clearOnComplete is set", () => {
            expect.assertions(1);

            const { manager } = createManagerStub();
            const eraseSpy = vi.spyOn(manager, "erase");
            const bar = new ProgressBar({ clearOnComplete: true, format: "{value}", total: 100 }, manager);

            bar.start();
            bar.update(50);
            bar.stop();

            expect(eraseSpy).toHaveBeenCalledWith("stdout");
        });

        it("should not erase on stop by default", () => {
            expect.assertions(1);

            const { manager } = createManagerStub();
            const eraseSpy = vi.spyOn(manager, "erase");
            const bar = new ProgressBar({ format: "{value}", total: 100 }, manager);

            bar.start();
            bar.stop();

            expect(eraseSpy).not.toHaveBeenCalled();
        });

        it("should not fire complete logic twice when stop() is called after auto-stop", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", stopOnComplete: true, total: 100 }, manager);

            bar.start();
            bar.update(100);
            bar.stop();

            expect(state.unhookCalls).toBe(1);
        });
    });
});

describe("applyStyleToOptions", () => {
    it("should return options unchanged when no style is set", () => {
        expect.assertions(1);

        const options = { total: 100 };

        expect(applyStyleToOptions(options)).toBe(options);
    });

    it("should fill default chars when style is set", () => {
        expect.assertions(3);

        const out = applyStyleToOptions<ProgressBarOptions>({ style: "ascii", total: 100 });

        expect(out.barCompleteChar).toBe("#");
        expect(out.barIncompleteChar).toBe("-");
        expect(out.barGlue).toBe("");
    });

    it("should not overwrite already-set chars", () => {
        expect.assertions(2);

        const out = applyStyleToOptions({ barCompleteChar: "X", barIncompleteChar: ".", style: "ascii", total: 100 });

        expect(out.barCompleteChar).toBe("X");
        expect(out.barIncompleteChar).toBe(".");
    });
});

describe("getBarChar", () => {
    it("should return custom char if provided", () => {
        expect.assertions(1);

        expect(getBarChar("X", "ascii")).toBe("X");
    });

    it("should return ascii complete char", () => {
        expect.assertions(1);

        expect(getBarChar(undefined, "ascii", true)).toBe("#");
    });

    it("should return ascii incomplete char", () => {
        expect.assertions(1);

        expect(getBarChar(undefined, "ascii", false)).toBe("-");
    });

    it("should return shades_classic chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "shades_classic", true)).toBe("█");
        expect(getBarChar(undefined, "shades_classic", false)).toBe("░");
    });

    it("should return braille chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "braille", true)).toBe("⣿");
        expect(getBarChar(undefined, "braille", false)).toBe("⠤");
    });

    it("should return filled chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "filled", true)).toBe("█");
        expect(getBarChar(undefined, "filled", false)).toBe(" ");
    });

    it("should return solid chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "solid", true)).toBe("█");
        expect(getBarChar(undefined, "solid", false)).toBe(" ");
    });

    it("should return rect chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "rect", true)).toBe("▬");
        expect(getBarChar(undefined, "rect", false)).toBe("▭");
    });

    it("should return shades_grey chars", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "shades_grey", true)).toBe("▓");
        expect(getBarChar(undefined, "shades_grey", false)).toBe("░");
    });

    it("should return defaults when style is unknown", () => {
        expect.assertions(2);

        expect(getBarChar(undefined, "custom", true)).toBe("█");
        expect(getBarChar(undefined, "custom", false)).toBe("░");
    });
});
