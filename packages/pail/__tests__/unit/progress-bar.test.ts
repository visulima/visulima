import { describe, expect, it } from "vitest";

import { applyStyleToOptions, getBarChar, MultiProgressBar, ProgressBar } from "../../src/progress-bar";

describe(ProgressBar, () => {
    describe("constructor", () => {
        it("should create a progress bar with default options", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ total: 100 });

            expect(bar).toBeInstanceOf(ProgressBar);
        });

        it("should create a progress bar with custom options", () => {
            expect.assertions(2);

            const bar = new ProgressBar({
                current: 10,
                format: "Custom: [{bar}] {percentage}%",
                total: 50,
                width: 20,
            });

            const result = bar.render();

            expect(result).toContain("Custom:");
            expect(result).toContain("20%"); // 10/50 = 20%
        });
    });

    describe("render", () => {
        it("should render progress correctly", () => {
            expect.assertions(4);

            const bar = new ProgressBar({
                format: "Progress: [{bar}] {percentage}% | {value}/{total}",
                total: 10,
            });

            bar.update(5);
            const result = bar.render();

            expect(result).toContain("Progress:");
            expect(result).toContain("50%"); // 5/10 = 50%
            expect(result).toContain("5/10");
            expect(result).toContain("██████████"); // 10 filled characters for 50%
        });

        it("should handle 0% progress", () => {
            expect.assertions(3);

            const bar = new ProgressBar({ total: 10 });
            const result = bar.render();

            expect(result).toContain("0%");
            expect(result).toContain("0/10");
            expect(result).toContain("░".repeat(40)); // Default width is 40
        });

        it("should handle 100% progress", () => {
            expect.assertions(3);

            const bar = new ProgressBar({ total: 10 });

            bar.update(10);
            const result = bar.render();

            expect(result).toContain("100%");
            expect(result).toContain("10/10");
            expect(result).toContain("█".repeat(40)); // Full bar
        });

        it("should handle payload replacement", () => {
            expect.assertions(3);

            const bar = new ProgressBar(
                {
                    format: "Downloading {filename}: [{bar}] {percentage}% | Speed: {speed}",
                    total: 100,
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
            expect.assertions(2);

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
            expect.assertions(2);

            const bar = new ProgressBar({ total: 100 });

            bar.update(25);

            expect(bar.render()).toContain("25%");

            bar.update(75);

            expect(bar.render()).toContain("75%");
        });

        it("should not exceed total", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ total: 10 });

            bar.update(15); // Try to go over total

            expect(bar.render()).toContain("10/10"); // Should be capped at total
        });

        it("should update payload", () => {
            expect.assertions(2);

            const bar = new ProgressBar(
                {
                    format: "Progress: {percentage}% | {status}",
                    total: 100,
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
            expect.assertions(2);

            const bar = new ProgressBar({ total: 100 });

            bar.increment(10);

            expect(bar.render()).toContain("10%");

            bar.increment(20);

            expect(bar.render()).toContain("30%");
        });

        it("should increment with payload", () => {
            expect.assertions(2);

            const bar = new ProgressBar(
                {
                    format: "Progress: {percentage}% | {phase}",
                    total: 100,
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
            expect.assertions(2);

            const bar = new ProgressBar({ total: 50 });

            bar.start(100); // Change total to 100
            bar.update(25);

            expect(bar.render()).toContain("25%");
            expect(bar.render()).toContain("25/100");
        });

        it("should handle start with start value", () => {
            expect.assertions(1);

            const bar = new ProgressBar({ total: 100 });

            bar.start(100, 50); // Start at 50

            expect(bar.render()).toContain("50%");
        });
    });
});

describe(getBarChar, () => {
    it("should return custom char if provided", () => {
        expect.assertions(1);
        expect(getBarChar("🚀", "shades_classic", true)).toBe("🚀");
    });

    it("should return correct chars for shades_classic style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "shades_classic", true)).toBe("█");
        expect(getBarChar(undefined, "shades_classic", false)).toBe("░");
    });

    it("should return correct chars for shades_grey style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "shades_grey", true)).toBe("▓");
        expect(getBarChar(undefined, "shades_grey", false)).toBe("░");
    });

    it("should return correct chars for rect style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "rect", true)).toBe("▬");
        expect(getBarChar(undefined, "rect", false)).toBe("▭");
    });

    it("should return correct chars for filled style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "filled", true)).toBe("█");
        expect(getBarChar(undefined, "filled", false)).toBe(" ");
    });

    it("should return correct chars for solid style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "solid", true)).toBe("█");
        expect(getBarChar(undefined, "solid", false)).toBe(" ");
    });

    it("should return correct chars for ascii style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "ascii", true)).toBe("#");
        expect(getBarChar(undefined, "ascii", false)).toBe("-");
    });
});

describe(applyStyleToOptions, () => {
    it("should return options unchanged if no style", () => {
        expect.assertions(1);

        const options = { total: 100, width: 20 };
        const result = applyStyleToOptions(options) as any;

        expect(result).toStrictEqual(options);
    });

    it("should apply style defaults", () => {
        expect.assertions(3);

        const options = {
            style: "ascii" as const,
            total: 100,
        };
        const result = applyStyleToOptions(options) as any;

        expect(result.barCompleteChar).toBe("#");
        expect(result.barIncompleteChar).toBe("-");
        expect(result.barGlue).toBe("");
    });

    it("should allow overrides of style defaults", () => {
        expect.assertions(3);

        const options = {
            barCompleteChar: "🚀",
            barIncompleteChar: "🌟",
            style: "ascii" as const,
            total: 100,
        };
        const result = applyStyleToOptions(options) as any;

        expect(result.barCompleteChar).toBe("🚀"); // Override preserved
        expect(result.barIncompleteChar).toBe("🌟"); // Override preserved
        expect(result.barGlue).toBe(""); // Style default applied
    });
});

describe(MultiProgressBar, () => {
    it("should create a multi progress bar", () => {
        expect.assertions(1);

        const multiBar = new MultiProgressBar();

        expect(multiBar).toBeInstanceOf(MultiProgressBar);
    });

    it("should create bars with correct options", () => {
        expect.assertions(3);

        const multiBar = new MultiProgressBar({
            format: "Task {task}: [{bar}] {percentage}%",
            style: "ascii",
        });

        const bar = multiBar.create(100, 0, { task: "test" });

        expect(bar).toBeInstanceOf(ProgressBar);

        bar.update(50);
        const result = bar.render();

        expect(result).toContain("Task test:");
        expect(result).toContain("50%");
    });

    it("should handle multiple bars", () => {
        expect.assertions(4);

        const multiBar = new MultiProgressBar({
            format: "{task}: [{bar}] {percentage}%",
            style: "rect",
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
        expect.assertions(3);

        const multiBar = new MultiProgressBar();
        const bar1 = multiBar.create(10);
        const bar2 = multiBar.create(10);

        expect(multiBar.remove(bar1)).toBe(true);
        expect(multiBar.remove(bar2)).toBe(true);
        expect(multiBar.remove(bar1)).toBe(false); // Already removed
    });
});

describe("integration with PailServer", () => {
    it("should create progress bars through PailServer", () => {
        expect.assertions(3);

        const options = {
            style: "ascii" as const,
            total: 100,
        };

        const styledOptions = applyStyleToOptions(options) as any;

        expect(styledOptions.barCompleteChar).toBe("#");
        expect(styledOptions.barIncompleteChar).toBe("-");
        expect(styledOptions.total).toBe(100);
    });
});
