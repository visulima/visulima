import type { InteractiveManager } from "@visulima/interactive-manager";
import { describe, expect, it, vi } from "vitest";

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

            const { manager, state } = createManagerStub();
            const bar = new ProgressBar({ format: "{value}", total: 100 }, manager);

            bar.start();
            state.updates.length = 0;
            bar.update(42);

            expect(state.updates.at(-1)?.[0]).toBe("42");
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
    });
});

describe("applyStyleToOptions", () => {
    it("should return options unchanged when no style is set", () => {
        expect.assertions(1);

        const opts = { total: 100 };

        expect(applyStyleToOptions(opts)).toBe(opts);
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getBarChar(undefined, "custom" as any, true)).toBe("█");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getBarChar(undefined, "custom" as any, false)).toBe("░");
    });
});
