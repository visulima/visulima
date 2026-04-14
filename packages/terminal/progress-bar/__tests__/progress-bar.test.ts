import { describe, expect, it } from "vitest";

import { ProgressBar } from "../src/progress-bar";
import { getBarChar } from "../src/utils";

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
});
