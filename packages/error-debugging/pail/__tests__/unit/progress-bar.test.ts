import { blue, red, yellow } from "@visulima/colorize";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import type { MultiBarInstance } from "../../src/progress-bar";
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

describe("getCompositeChar", () => {
    let multiBar: MultiProgressBar;
    let mockBars: MultiBarInstance[];

    beforeEach(() => {
        multiBar = new MultiProgressBar();
        // Create mock bars with different indices and getBarState method
        mockBars = [
            {
                bar: new ProgressBar({ total: 100 }),
                getBarState: () => {
                    return { char: "█", current: 50, total: 100 };
                },
                index: 0,
            } as any as MultiBarInstance,
            {
                bar: new ProgressBar({ total: 100 }),
                getBarState: () => {
                    return { char: "█", current: 70, total: 100 };
                },
                index: 1,
            } as any as MultiBarInstance,
            {
                bar: new ProgressBar({ total: 100 }),
                getBarState: () => {
                    return { char: "█", current: 90, total: 100 };
                },
                index: 2,
            } as any as MultiBarInstance,
        ];
    });

    it("should return solid block for single bar", () => {
        expect.assertions(1);

        const result = (multiBar as any).getCompositeChar(mockBars, [0], 0, 40);

        expect(result).toBe("█");
    });

    it("should return medium shade for two bars and use highest index", () => {
        expect.assertions(2);

        const result = (multiBar as any).getCompositeChar(mockBars, [0, 1], 0, 40);

        expect(result).toBe("▓");
        // The result should be colored, but we can't easily test the color here
        expect(result.length).toBeGreaterThan(0);
    });

    it("should return lighter shade for three bars", () => {
        expect.assertions(1);

        const result = (multiBar as any).getCompositeChar(mockBars, [0, 1, 2], 0, 40);

        expect(result).toBe("▒");
    });

    it("should return lightest shade for four or more bars", () => {
        expect.assertions(2);

        const result4 = (multiBar as any).getCompositeChar(mockBars, [0, 1, 2, 3], 0, 40);
        const result5 = (multiBar as any).getCompositeChar(mockBars, [0, 1, 2, 3, 4], 0, 40);

        expect(result4).toBe("░");
        expect(result5).toBe("░");
    });

    it("should handle undefined stack", () => {
        expect.assertions(1);

        const result = (multiBar as any).getCompositeChar(mockBars, undefined, 0, 40);

        expect(result).toBe("█");
    });

    it("should handle empty stack", () => {
        expect.assertions(1);

        const result = (multiBar as any).getCompositeChar(mockBars, [], 0, 40);

        expect(result).toBe("█");
    });

    it("should handle out of bounds bar index", () => {
        expect.assertions(1);

        const result = (multiBar as any).getCompositeChar(mockBars, [99], 0, 40);

        expect(result).toBe("█");
    });

    it("should show bar with lowest progress percentage on top", () => {
        expect.assertions(1);

        // Create bars with different progress rates
        const bars: any = [
            {
                getBarState: () => {
                    return { char: "█", current: 10, total: 100 };
                },
                index: 0,
            }, // 10% progress
            {
                getBarState: () => {
                    return { char: "█", current: 20, total: 100 };
                },
                index: 1,
            }, // 20% progress
            {
                getBarState: () => {
                    return { char: "█", current: 50, total: 100 };
                },
                index: 2,
            }, // 50% progress
        ];

        // When multiple bars are in stack, show the one with SMALLEST progress percentage
        // At position 5, all three bars are filled (5 < 10, 5 < 20, 5 < 50)
        // Bar 0 has smallest % (10%), so it should be selected
        multiBar.setBarColor(bars[0], red);
        multiBar.setBarColor(bars[1], yellow);
        multiBar.setBarColor(bars[2], blue);

        const result = (multiBar as any).getCompositeChar(bars, [0, 1, 2], 5, 40);

        // Should return the character colored with the first bar's color (smallest progress)
        expect(result).toContain("▒"); // 3 bars overlap = light shade
    });
});

describe("progressBar gradient mode", () => {
    it("should normalize mixed gradient/string types", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            barCompleteChar: ["█", "▓", "▒"],
            barIncompleteChar: "░",
            total: 100,
        });

        const output = bar.render();

        expect(output).toBeDefined();

        expectTypeOf(output).toBeString();
    });

    it("should handle boundary condition at 100% complete", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            barCompleteChar: ["█", "▓", "▒"],
            current: 100,
            total: 100,
            width: 20,
        });

        const output = bar.render();

        expect(output).toBeDefined();

        expectTypeOf(output).toBeString();
    });

    it("should not create out-of-bounds array access", () => {
        expect.assertions(1);

        const outputs = [];

        for (let i = 0; i <= 100; i += 10) {
            const bar = new ProgressBar({
                barCompleteChar: ["█", "▓", "▒"],
                current: i,
                total: 100,
                width: 20,
            });

            outputs.push(bar.render());
        }

        expect(outputs).toHaveLength(11);
    });

    it("should handle single-element gradient array", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            barCompleteChar: ["█"],
            current: 50,
            total: 100,
            width: 20,
        });

        const output = bar.render();

        expect(output).toBeDefined();

        expectTypeOf(output).toBeString();
    });

    it("should use correct gradient style detection", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            barCompleteChar: ["▬", "▮", "▯"],
            style: "rect",
            total: 100,
        });

        const output = bar.render();

        expect(output).toBeDefined();
    });
});

describe("braille style", () => {
    it("should return correct chars for braille style", () => {
        expect.assertions(2);
        expect(getBarChar(undefined, "braille", true)).toBe("⣿");
        expect(getBarChar(undefined, "braille", false)).toBe("⠤");
    });

    it("should render a braille bar with filled and empty characters", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 5,
            style: "braille",
            total: 10,
            width: 20,
        });

        const result = bar.render();

        expect(result).toContain("⣿");
        expect(result).toContain("⠤");
    });

    it("should auto-enable rounded caps for braille style", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 5,
            style: "braille",
            total: 10,
            width: 20,
        });

        const result = bar.render();

        // First char should be left cap, last char in bar should be right cap
        expect(result).toContain("⢾");
        expect(result).toContain("⡷");
    });

    it("should allow disabling rounded caps explicitly", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 5,
            roundedCaps: false,
            style: "braille",
            total: 10,
            width: 20,
        });

        const result = bar.render();

        expect(result).not.toContain("⢾");
        expect(result).not.toContain("⡷");
    });

    it("should allow enabling rounded caps on non-braille styles", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 5,
            roundedCaps: true,
            style: "shades_classic",
            total: 10,
            width: 20,
        });

        const result = bar.render();

        expect(result).toContain("⢾");
        expect(result).toContain("⡷");
    });

    it("should not apply caps when width < 2", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 1,
            style: "braille",
            total: 10,
            width: 1,
        });

        const result = bar.render();

        expect(result).not.toContain("⢾");
        expect(result).not.toContain("⡷");
    });

    it("should render full braille bar at 100%", () => {
        expect.assertions(3);

        const bar = new ProgressBar({
            current: 10,
            style: "braille",
            total: 10,
            width: 10,
        });

        const result = bar.render();

        expect(result).toContain("⢾");
        expect(result).toContain("⡷");
        expect(result).not.toContain("⠤"); // No empty chars
    });

    it("should render empty braille bar at 0%", () => {
        expect.assertions(3);

        const bar = new ProgressBar({
            current: 0,
            style: "braille",
            total: 10,
            width: 10,
        });

        const result = bar.render();

        expect(result).toContain("⢾"); // Still has caps
        expect(result).toContain("⡷");
        expect(result).toContain("⠤"); // Empty chars in between
    });

    it("should apply braille style via applyStyleToOptions", () => {
        expect.assertions(2);

        const options = {
            style: "braille" as const,
            total: 100,
        };
        const result = applyStyleToOptions(options) as any;

        expect(result.barCompleteChar).toBe("⣿");
        expect(result.barIncompleteChar).toBe("⠤");
    });
});

describe("peak marker", () => {
    it("should render a peak marker at the specified position", () => {
        expect.assertions(3);

        const bar = new ProgressBar({
            current: 30,
            peak: 80,
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        const result = bar.render();

        expect(result).toContain("▏");
        expect(result).toContain("30%");
        expect(result).toContain("30/100");
    });

    it("should place peak at fill boundary when peak < current", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            current: 50,
            format: "[{bar}]",
            peak: 10,
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        const result = bar.render();

        // Peak should be forced to at least the fill boundary
        expect(result).toContain("▏");
    });

    it("should not render peak marker when peak is 0", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            current: 50,
            format: "[{bar}]",
            peak: 0,
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        const result = bar.render();

        expect(result).not.toContain("▏");
    });

    it("should not render peak marker when peak is undefined", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            current: 50,
            format: "[{bar}]",
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        const result = bar.render();

        expect(result).not.toContain("▏");
    });

    it("should use completeChar as default peakChar", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            current: 30,
            format: "[{bar}]",
            peak: 80,
            style: "ascii",
            total: 100,
            width: 20,
        });

        const result = bar.render();
        const barContent = result.slice(1, -1); // Strip brackets

        // Peak char defaults to completeChar "#" — the bar should have # at peak position
        // 80% of 20 = position 16
        expect(barContent[16]).toBe("#");
    });

    it("should update peak via setPeak", () => {
        expect.assertions(2);

        const bar = new ProgressBar({
            current: 30,
            format: "[{bar}]",
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        // Initially no peak
        expect(bar.render()).not.toContain("▏");

        bar.setPeak(80);

        expect(bar.render()).toContain("▏");
    });

    it("should combine peak marker with braille style and rounded caps", () => {
        expect.assertions(4);

        const bar = new ProgressBar({
            current: 30,
            peak: 70,
            peakChar: "⡿",
            style: "braille",
            total: 100,
            width: 20,
        });

        const result = bar.render();

        expect(result).toContain("⢾"); // Left cap
        expect(result).toContain("⡷"); // Right cap
        expect(result).toContain("⡿"); // Peak marker
        expect(result).toContain("30%");
    });

    it("should clamp peak to bar width boundary", () => {
        expect.assertions(1);

        const bar = new ProgressBar({
            current: 50,
            format: "[{bar}]",
            peak: 200,
            peakChar: "▏",
            total: 100,
            width: 20,
        });

        const result = bar.render();
        const barContent = result.slice(1, -1); // Strip brackets

        // Peak at 200% should be clamped to last position (width - 1 = 19)
        expect(barContent[19]).toBe("▏");
    });
});
