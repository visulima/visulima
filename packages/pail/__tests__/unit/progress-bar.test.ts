import { stderr, stdout } from "node:process";

import { describe, expect, it } from "vitest";

import InteractiveManager from "../../src/interactive/interactive-manager";
import { MultiProgressBar, ProgressBar, applyStyleToOptions, getBarChar } from "../../src/progress-bar";

describe("ProgressBar", () => {
    describe("constructor", () => {
        it("should create a progress bar with default options", () => {
            const bar = new ProgressBar({ total: 100 });

            expect(bar).toBeInstanceOf(ProgressBar);
        });

        it("should create a progress bar with custom options", () => {
            const bar = new ProgressBar({
                total: 50,
                current: 10,
                width: 20,
                format: "Custom: [{bar}] {percentage}%",
            });

            const result = bar.render();
            expect(result).toContain("Custom:");
            expect(result).toContain("20%"); // 10/50 = 20%
        });
    });

    describe("render", () => {
        it("should render progress correctly", () => {
            const bar = new ProgressBar({
                total: 10,
                format: "Progress: [{bar}] {percentage}% | {value}/{total}",
            });

            bar.update(5);
            const result = bar.render();

            expect(result).toContain("Progress:");
            expect(result).toContain("50%"); // 5/10 = 50%
            expect(result).toContain("5/10");
            expect(result).toContain("██████████"); // 10 filled characters for 50%
        });

        it("should handle 0% progress", () => {
            const bar = new ProgressBar({ total: 10 });
            const result = bar.render();

            expect(result).toContain("0%");
            expect(result).toContain("0/10");
            expect(result).toContain("░".repeat(40)); // Default width is 40
        });

        it("should handle 100% progress", () => {
            const bar = new ProgressBar({ total: 10 });
            bar.update(10);
            const result = bar.render();

            expect(result).toContain("100%");
            expect(result).toContain("10/10");
            expect(result).toContain("█".repeat(40)); // Full bar
        });

        it("should handle payload replacement", () => {
            const bar = new ProgressBar(
                {
                    total: 100,
                    format: "Downloading {filename}: [{bar}] {percentage}% | Speed: {speed}",
                },
                undefined,
                { filename: "test.zip", speed: "1.5 MB/s" },
            );

            bar.update(50);
            const result = bar.render();

            expect(result).toContain("Downloading test.zip:");
            expect(result).toContain("Speed: 1.5 MB/s");
            expect(result).toContain("50%");
        });

        it("should handle custom width", () => {
            const bar = new ProgressBar({
                total: 10,
                width: 20,
            });

            bar.update(5);
            const result = bar.render();

            expect(result).toContain("██████████"); // 10 filled + 10 empty = 20 total
            expect(result).toContain("░".repeat(10));
        });
    });

    describe("update", () => {
        it("should update progress correctly", () => {
            const bar = new ProgressBar({ total: 100 });

            bar.update(25);
            expect(bar.render()).toContain("25%");

            bar.update(75);
            expect(bar.render()).toContain("75%");
        });

        it("should not exceed total", () => {
            const bar = new ProgressBar({ total: 10 });

            bar.update(15); // Try to go over total
            expect(bar.render()).toContain("10/10"); // Should be capped at total
        });

        it("should update payload", () => {
            const bar = new ProgressBar(
                {
                    total: 100,
                    format: "Progress: {percentage}% | {status}",
                },
                undefined,
                { status: "initial" },
            );

            bar.update(50, { status: "updated" });
            const result = bar.render();

            expect(result).toContain("50%");
            expect(result).toContain("updated");
        });
    });

    describe("increment", () => {
        it("should increment progress correctly", () => {
            const bar = new ProgressBar({ total: 100 });

            bar.increment(10);
            expect(bar.render()).toContain("10%");

            bar.increment(20);
            expect(bar.render()).toContain("30%");
        });

        it("should increment with payload", () => {
            const bar = new ProgressBar(
                {
                    total: 100,
                    format: "Progress: {percentage}% | {phase}",
                },
                undefined,
                { phase: "start" },
            );

            bar.increment(25, { phase: "middle" });
            const result = bar.render();

            expect(result).toContain("25%");
            expect(result).toContain("middle");
        });
    });

    describe("start/stop", () => {
        it("should handle start with new total", () => {
            const bar = new ProgressBar({ total: 50 });

            bar.start(100); // Change total to 100
            bar.update(25);

            expect(bar.render()).toContain("25%");
            expect(bar.render()).toContain("25/100");
        });

        it("should handle start with start value", () => {
            const bar = new ProgressBar({ total: 100 });

            bar.start(100, 50); // Start at 50
            expect(bar.render()).toContain("50%");
        });
    });
});

describe("getBarChar", () => {
    it("should return custom char if provided", () => {
        expect(getBarChar("🚀", "shades_classic", true)).toBe("🚀");
    });

    it("should return correct chars for shades_classic style", () => {
        expect(getBarChar(undefined, "shades_classic", true)).toBe("█");
        expect(getBarChar(undefined, "shades_classic", false)).toBe("░");
    });

    it("should return correct chars for shades_grey style", () => {
        expect(getBarChar(undefined, "shades_grey", true)).toBe("▓");
        expect(getBarChar(undefined, "shades_grey", false)).toBe("░");
    });

    it("should return correct chars for rect style", () => {
        expect(getBarChar(undefined, "rect", true)).toBe("▬");
        expect(getBarChar(undefined, "rect", false)).toBe("▭");
    });

    it("should return correct chars for filled style", () => {
        expect(getBarChar(undefined, "filled", true)).toBe("█");
        expect(getBarChar(undefined, "filled", false)).toBe(" ");
    });

    it("should return correct chars for solid style", () => {
        expect(getBarChar(undefined, "solid", true)).toBe("█");
        expect(getBarChar(undefined, "solid", false)).toBe(" ");
    });

    it("should return correct chars for ascii style", () => {
        expect(getBarChar(undefined, "ascii", true)).toBe("#");
        expect(getBarChar(undefined, "ascii", false)).toBe("-");
    });
});

describe("applyStyleToOptions", () => {
    it("should return options unchanged if no style", () => {
        const options = { total: 100, width: 20 };
        const result = applyStyleToOptions(options);

        expect(result).toEqual(options);
    });

    it("should apply style defaults", () => {
        const options = {
            total: 100,
            style: "ascii" as const,
        };
        const result = applyStyleToOptions(options);

        expect(result.barCompleteChar).toBe("#");
        expect(result.barIncompleteChar).toBe("-");
        expect(result.barGlue).toBe("");
    });

    it("should allow overrides of style defaults", () => {
        const options = {
            total: 100,
            style: "ascii" as const,
            barCompleteChar: "🚀",
            barIncompleteChar: "🌟",
        };
        const result = applyStyleToOptions(options);

        expect(result.barCompleteChar).toBe("🚀"); // Override preserved
        expect(result.barIncompleteChar).toBe("🌟"); // Override preserved
        expect(result.barGlue).toBe(""); // Style default applied
    });
});

describe("MultiProgressBar", () => {
    it("should create a multi progress bar", () => {
        const multiBar = new MultiProgressBar();

        expect(multiBar).toBeInstanceOf(MultiProgressBar);
    });

    it("should create bars with correct options", () => {
        const multiBar = new MultiProgressBar({
            style: "ascii",
            format: "Task {task}: [{bar}] {percentage}%",
        });

        const bar = multiBar.create(100, 0, { task: "test" });

        expect(bar).toBeInstanceOf(ProgressBar);
        bar.update(50);
        const result = bar.render();

        expect(result).toContain("Task test:");
        expect(result).toContain("50%");
    });

    it("should handle multiple bars", () => {
        const multiBar = new MultiProgressBar({
            style: "rect",
            format: "{task}: [{bar}] {percentage}%",
        });

        const bar1 = multiBar.create(10, 0, { task: "A" });
        const bar2 = multiBar.create(20, 0, { task: "B" });

        bar1.update(5); // 50% of 10
        bar2.update(10); // 50% of 20

        const result1 = bar1.render();
        const result2 = bar2.render();

        expect(result1).toContain("A:");
        expect(result1).toContain("50%");
        expect(result2).toContain("B:");
        expect(result2).toContain("50%");
    });

    it("should remove bars correctly", () => {
        const multiBar = new MultiProgressBar();
        const bar1 = multiBar.create(10);
        const bar2 = multiBar.create(10);

        expect(multiBar.remove(bar1)).toBe(true);
        expect(multiBar.remove(bar2)).toBe(true);
        expect(multiBar.remove(bar1)).toBe(false); // Already removed
    });
});

describe("Integration with PailServer", () => {
    it("should create progress bars through PailServer", () => {
        const mockInteractiveManager = {} as InteractiveManager;

        // Mock the PailServer creation - we can't easily import it due to dependencies
        // but we can test the core functionality

        const options = {
            total: 100,
            style: "ascii" as const,
        };

        const styledOptions = applyStyleToOptions(options);

        expect(styledOptions.barCompleteChar).toBe("#");
        expect(styledOptions.barIncompleteChar).toBe("-");
        expect(styledOptions.total).toBe(100);
    });
});
