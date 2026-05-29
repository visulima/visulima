import type { InteractiveManager } from "@visulima/interactive-manager";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        update: vi.fn((stream: string, rows: string[]) => {
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
    });

    describe("setBarColor", () => {
        it("should apply a color function to the composite output", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<RED>${text}</RED>`;

            const bar = multi.create(100) as never as MultiBarInstance;

            multi.setBarColor(bar, colorize);
            bar.update(50);

            const last = state.updates.at(-1);

            expect(last?.rows[0]).toContain("<RED>");
        });

        it("should remove an applied color when called with undefined", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<RED>${text}</RED>`;

            const bar = multi.create(100) as never as MultiBarInstance;

            multi.setBarColor(bar, colorize);
            multi.setBarColor(bar, undefined);
            bar.update(50);

            const last = state.updates.at(-1);

            expect(last?.rows[0]).not.toContain("<RED>");
        });

        it("should skip non-matching bars when assigning a color to a later bar", () => {
            expect.assertions(1);

            const { manager, state } = createManagerStub();
            const multi = new MultiProgressBar({ composite: true, format: "[{bar}]" }, manager);
            const colorize = (text: string): string => `<C>${text}</C>`;

            multi.create(100);
            const second = multi.create(100) as never as MultiBarInstance;

            // Coloring the second bar makes setBarColor iterate past the first non-match.
            multi.setBarColor(second, colorize);
            second.update(50);

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
});
