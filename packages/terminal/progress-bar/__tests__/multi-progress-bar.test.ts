import type { InteractiveManager } from "@visulima/interactive-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MultiBarInstance } from "../src/multi-progress-bar";
import { MultiProgressBar } from "../src/multi-progress-bar";

// Hoisted to module scope so eslint's prefer-static-regex rule is satisfied.
const RECT_GRADIENT_RE = /[▬▮▯▭]/u;
const BRACKETED_BAR_RE = /^\[.+\]$/u;
const BRAILLE_GRADIENT_RE = /[⣿⡷⢾⠤]/u;

/**
 * Build a minimal stub that satisfies the calls `MultiProgressBar` makes
 * against `@visulima/interactive-manager`. We only care about `hook`,
 * `unhook`, and `update` — everything else is a no-op.
 */
const createManagerStub = (): {
    manager: InteractiveManager;
    state: { hookCalls: number; unhookCalls: number; updates: { rows: string[]; stream: string }[] };
} => {
    const state = {
        hookCalls: 0,
        unhookCalls: 0,
        updates: [] as { rows: string[]; stream: string }[],
    };

    const manager = {
        erase: vi.fn<() => void>(),
        hook: vi.fn<() => boolean>(() => {
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
        resume: vi.fn<() => void>(),
        suspend: vi.fn<() => void>(),
        unhook: vi.fn<() => boolean>(() => {
            state.unhookCalls += 1;

            return true;
        }),
        update: vi.fn<(stream: string, rows: string[]) => void>((stream: string, rows: string[]) => {
            state.updates.push({ rows: [...rows], stream });
        }),
    } as unknown as InteractiveManager;

    return { manager, state };
};

describe("multiProgressBar", () => {
    describe("create", () => {
        it("should create a bar without a manager and not throw", () => {
            expect.assertions(2);

            const multi = new MultiProgressBar();
            const bar = multi.create(100);

            expect(bar).toBeDefined();
            expect(bar.render()).toContain("0%");
        });

        it("should hook the manager on first bar create", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            multi.create(100);

            expect(state.hookCalls).toBe(1);
            expect(state.updates.length).toBeGreaterThan(0);
        });

        it("should only hook once when creating multiple bars", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            multi.create(100);
            multi.create(50);
            multi.create(25);

            expect(state.hookCalls).toBe(1);
        });

        it("should fall back to non-composite mode when composite is explicitly undefined", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: undefined, format: "[{bar}]" }, manager);

            multi.create(100);
            const bar2 = multi.create(100);

            // Re-render with both bars present; non-composite mode emits one row per bar.
            bar2.update(10);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            const last = state.updates.at(-1);

            expect(last?.rows.length).toBe(2);
        });

        it("should honour custom starting current and payload", () => {
            expect.assertions(2);

            const multi = new MultiProgressBar();
            const bar = multi.create(100, 25, { task: "build" });
            const output = bar.render();

            expect(output).toContain("25%");
            expect(output).toContain("25/100");
        });
    });

    describe("update / renderAll", () => {
        it("should re-render all bars when an individual bar is updated", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            const bar1 = multi.create(100);

            multi.create(50);

            state.updates.length = 0;

            bar1.update(50);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            // The latest update must include both bars in rows
            const last = state.updates.at(-1);

            expect(last).toBeDefined();
            expect(last?.rows.length).toBe(2);
        });

        it("should render percentage progress per bar", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            const bar1 = multi.create(100);
            const bar2 = multi.create(100);

            bar1.update(75);
            bar2.update(25);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            const last = state.updates.at(-1);

            expect(last?.rows[0]).toContain("75%");
            expect(last?.rows[1]).toContain("25%");
        });

        it("should be a no-op when no manager is attached", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar();

            const bar = multi.create(100);

            // Should not throw — renderAll just returns without a manager.
            expect(() => {
                bar.update(50);
            }).not.toThrow();
        });
    });

    describe("remove", () => {
        it("should remove a bar and unhook when last bar is removed", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            const bar = multi.create(100);
            const removed = multi.remove(bar);

            expect(removed).toBe(true);
            expect(state.unhookCalls).toBe(1);
        });

        it("should keep manager hooked when only one of several bars is removed", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            const bar1 = multi.create(100);

            multi.create(50);

            const removed = multi.remove(bar1);

            expect(removed).toBe(true);
            expect(state.unhookCalls).toBe(0);
        });

        it("should return false when removing a bar that was not created here", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar();
            const other = new MultiProgressBar();
            const otherBar = other.create(100);

            expect(multi.remove(otherBar)).toBe(false);
        });

        it("should skip non-matching bars before removing the requested one", () => {
            expect.assertions(2);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            multi.create(100);
            const second = multi.create(50);

            // Removing the second bar forces the loop to skip the first (non-matching) entry.
            const removed = multi.remove(second);

            expect(removed).toBe(true);
            expect(state.unhookCalls).toBe(0);
        });

        it("should remove the last bar without a manager and not throw", () => {
            expect.assertions(2);

            const multi = new MultiProgressBar();
            const bar = multi.create(100);

            let removed = false;

            expect(() => {
                removed = multi.remove(bar);
            }).not.toThrow();
            expect(removed).toBe(true);
        });
    });

    describe("stop", () => {
        it("should unhook the manager and mark inactive", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({}, manager);

            multi.create(100);
            multi.stop();

            expect(state.unhookCalls).toBe(1);
        });

        it("should not throw without a manager", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar();

            expect(() => {
                multi.stop();
            }).not.toThrow();
        });
    });

    describe("composite mode", () => {
        let stub: ReturnType<typeof createManagerStub>;

        beforeEach(() => {
            stub = createManagerStub();
        });

        it("should render a single composite line for many bars", () => {
            expect.assertions(2);

            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, stub.manager);

            multi.create(100);
            multi.create(100);

            const last = stub.state.updates.at(-1);

            expect(last?.rows.length).toBe(1);
            expect(last?.rows[0]).toMatch(BRACKETED_BAR_RE);
        });

        it("should render only incomplete characters when bars are empty", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]", style: "ascii" }, stub.manager);

            multi.create(100);
            multi.create(100);

            const last = stub.state.updates.at(-1);

            expect(last?.rows[0]).toContain("-");
        });

        it("should render rect-style composite chars when partial bars overlap", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]", style: "rect" }, stub.manager);

            const bar1 = multi.create(100);
            const bar2 = multi.create(100);

            bar1.update(50);
            bar2.update(50);

            const last = stub.state.updates.at(-1);

            // rect gradient pulls from CHAR_GRADIENTS.rect: ["▬", "▮", "▯", "▭"]
            expect(last?.rows[0]).toMatch(RECT_GRADIENT_RE);
        });

        it("should render braille gradient chars in composite mode", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]", style: "braille" }, stub.manager);

            const bar1 = multi.create(100);
            const bar2 = multi.create(100);

            bar1.update(50);
            bar2.update(50);

            const last = stub.state.updates.at(-1);

            expect(last?.rows[0]).toMatch(BRAILLE_GRADIENT_RE);
        });

        it("should return the raw render output when the format has no bracketed bar section", () => {
            expect.assertions(2);

            // Without a `[...]` section the composite renderer cannot inject a grid,
            // so it returns the first bar's rendered line verbatim.
            const multi = new MultiProgressBar({ composite: true, format: "{percentage}%" }, stub.manager);

            multi.create(100);
            multi.create(100);

            const last = stub.state.updates.at(-1);

            expect(last?.rows.length).toBe(1);
            expect(last?.rows[0]).toBe("0%");
        });

        it("should pick the lowest-percentage bar when stacked bars overlap with mixed progress", () => {
            expect.assertions(1);

            // Bars at 30/90/30: within a shared cell the second (higher) bar fails the
            // `<` check, exercising the tie/greater branch of the selection logic, and the
            // third bar ties the smallest percentage so the larger index wins.
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]", style: "rect" }, stub.manager);

            const bar1 = multi.create(100);
            const bar2 = multi.create(100);
            const bar3 = multi.create(100);

            bar1.update(30);
            bar2.update(90);
            bar3.update(30);

            const last = stub.state.updates.at(-1);

            expect(last?.rows[0]).toMatch(RECT_GRADIENT_RE);
        });

        it("should render a dense (non-empty) char for columns filled by every bar", () => {
            expect.assertions(2);

            // Four fully-complete bars cover every column; the composite must not collapse
            // onto the empty/incomplete character (which would make a full column look empty).
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, stub.manager);

            for (let index = 0; index < 4; index += 1) {
                multi.create(100, 100, undefined, { width: 3 });
            }

            multi.stop();

            const last = stub.state.updates.at(-1);

            // shades_classic incomplete char is "░"; the fully-stacked column picks the densest "█".
            expect(last?.rows[0]).not.toContain("░");
            expect(last?.rows[0]).toBe("[███]");
        });

        it("should keep the configured width when composite is combined with barGlue", () => {
            expect.assertions(1);

            // barGlue must not double the measured composite width: 3 cells joined by "-".
            const multi = new MultiProgressBar({ barGlue: "-", composite: true, format: "[{bar}]" }, stub.manager);

            multi.create(100, 100, undefined, { width: 3 });
            multi.create(100, 100, undefined, { width: 3 });

            multi.stop();

            const last = stub.state.updates.at(-1);

            expect(last?.rows[0]).toBe("[█-█-█]");
        });

        it("should not corrupt the line when composite is combined with an ANSI formatBar", () => {
            expect.assertions(2);

            // An ANSI formatBar embeds "[" bytes; the composite renderer must measure and
            // inject against a clean line so BAR_REGEX never matches inside an escape sequence.
            const multi = new MultiProgressBar(
                { composite: true, format: "[{bar}]", formatBar: (bar) => `[31m${bar}[39m` },
                stub.manager,
            );

            multi.create(100, 100, undefined, { width: 3 });
            multi.create(100, 100, undefined, { width: 3 });

            multi.stop();

            const last = stub.state.updates.at(-1);

            expect(last?.rows[0]).not.toContain("39m");
            expect(last?.rows[0]).toBe("[███]");
        });
    });

    describe("setBarColor", () => {
        it("should apply a color function to the composite output", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<RED>${text}</RED>`;

            const bar = multi.create(100);

            multi.setBarColor(bar, colorize);
            bar.update(50);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            const last = state.updates.at(-1);

            expect(last?.rows[0]).toContain("<RED>");
        });

        it("should remove an applied color when called with undefined", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<RED>${text}</RED>`;

            const bar = multi.create(100);

            multi.setBarColor(bar, colorize);
            multi.setBarColor(bar, undefined);
            bar.update(50);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            const last = state.updates.at(-1);

            expect(last?.rows[0]).not.toContain("<RED>");
        });

        it("should skip non-matching bars when assigning a color to a later bar", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<C>${text}</C>`;

            multi.create(100);
            const second = multi.create(100);

            // Coloring the second bar makes setBarColor iterate past the first non-match.
            multi.setBarColor(second, colorize);
            second.update(50);
            // Flush the (throttled) frame so the assertion sees the latest render.
            multi.stop();

            const last = state.updates.at(-1);

            expect(last?.rows[0]).toContain("<C>");
        });
    });

    describe("getBarState", () => {
        it("should expose the current/total/char state for composite calculations", () => {
            expect.assertions(3);

            const multi = new MultiProgressBar();
            const bar = multi.create(200, 50) as never as MultiBarInstance;
            const state = bar.getBarState();

            expect(state.current).toBe(50);
            expect(state.total).toBe(200);
            expect(state.char).toBe("█");
        });

        it("should use the last entry of an array complete char", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ barCompleteChar: ["A", "B", "C"] });
            const bar = multi.create(100, 50) as never as MultiBarInstance;

            expect(bar.getBarState().char).toBe("C");
        });

        it("should fall back to the block char when the array complete char is empty", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ barCompleteChar: [] });
            const bar = multi.create(100, 50) as never as MultiBarInstance;

            expect(bar.getBarState().char).toBe("█");
        });
    });

    describe("per-bar create options", () => {
        it("should honour a per-bar width override", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar();
            const bar = multi.create(100, 50, undefined, { format: "[{bar}]", style: "ascii", width: 10 });

            expect(bar.render()).toBe("[#####-----]");
        });

        it("should honour a per-bar format override", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar();
            const bar = multi.create(100, 50, { task: "build" }, { format: "{task} {percentage}%" });

            expect(bar.render()).toBe("build 50%");
        });

        it("should honour a per-bar style override that differs from the multi default", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ style: "ascii" });
            const bar = multi.create(100, 50, undefined, { format: "[{bar}]", style: "braille", width: 10 });

            // Braille style adds pill caps -> the right cap char must be present.
            expect(bar.render()).toContain("⡷");
        });

        it("should forward the multi-level style to created bars (braille caps)", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ format: "[{bar}]", style: "braille" });
            const bar = multi.create(100, 50, undefined, { width: 10 });

            expect(bar.render()).toContain("⡷");
        });

        it("should forward the multi-level barGlue to created bars", () => {
            expect.assertions(1);

            const multi = new MultiProgressBar({ barGlue: "-", format: "[{bar}]", style: "ascii" });
            const bar = multi.create(100, 100, undefined, { width: 3 });

            // 3 filled chars joined by "-" glue.
            expect(bar.render()).toBe("[#-#-#]");
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
            const multi = new MultiProgressBar({ format: "{value}", fps: 10 }, manager);

            // First create forces a frame (lastRenderTime = 0).
            multi.create(100);
            state.updates.length = 0;

            // Advance one frame so the first update flushes, then two more in the same
            // frame must be coalesced => exactly one render.
            vi.setSystemTime(200);

            const bar = multi.create(100);

            state.updates.length = 0;

            bar.update(1);
            bar.update(2);
            bar.update(3);

            expect(state.updates).toHaveLength(1);
        });

        it("should render across separate frames", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ format: "{value}", fps: 10 }, manager);
            const bar = multi.create(100);

            state.updates.length = 0;

            vi.setSystemTime(200);
            bar.update(1);
            vi.setSystemTime(400);
            bar.update(2);

            expect(state.updates).toHaveLength(2);
        });

        it("should render every update when fps is 0 (disabled)", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ format: "{value}", fps: 0 }, manager);
            const bar = multi.create(100);

            state.updates.length = 0;

            bar.update(1);
            bar.update(2);
            bar.update(3);

            expect(state.updates).toHaveLength(3);
        });

        it("should always render the completion frame even when throttled", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ format: "{value}", fps: 10 }, manager);
            const bar = multi.create(100);

            state.updates.length = 0;

            // Within the same frame as create() -> throttled away, but reaching total
            // forces the final frame regardless of fps.
            bar.update(100);

            expect(state.updates.at(-1)?.rows[0]).toBe("100");
        });

        it("should always flush a final frame on stop()", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ format: "{value}", fps: 10 }, manager);
            const bar = multi.create(100);

            bar.update(1);
            bar.update(42); // throttled away
            multi.stop();

            expect(state.updates.at(-1)?.rows[0]).toBe("42");
        });

        it("should honour a per-bar fps override independent of the multi-level fps", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.setSystemTime(0);

            const { manager, state } = createManagerStub();
            // The multi-level throttle is disabled (fps 0); only the per-bar fps should gate.
            const multi = new MultiProgressBar({ format: "{value}", fps: 0 }, manager);
            const bar = multi.create(100, 0, undefined, { fps: 10 });

            state.updates.length = 0;

            vi.setSystemTime(200);
            bar.update(1);
            bar.update(2);
            bar.update(3);

            // Without the per-bar throttle all three would render (multi fps 0); the per-bar
            // fps of 10 coalesces the trailing two into the first frame.
            expect(state.updates).toHaveLength(1);
        });
    });

    describe("start / stop", () => {
        it("should re-render immediately when start() changes total and value", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ format: "{value}/{total}" }, manager);
            const bar = multi.create(100);

            state.updates.length = 0;

            bar.start(200, 50);

            expect(state.updates.at(-1)?.rows[0]).toContain("50/200");
        });
    });

    describe("composite warning", () => {
        it("should warn when composite is enabled without a bracketed bar region", () => {
            expect.assertions(2);

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

            const multi = new MultiProgressBar({ composite: true, format: "{percentage}%" });

            expect(multi).toBeDefined();
            expect(warnSpy).toHaveBeenCalledTimes(1);

            warnSpy.mockRestore();
        });

        it("should not warn when composite has a bracketed bar region", () => {
            expect.assertions(2);

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" });

            expect(multi).toBeDefined();
            expect(warnSpy).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});
