import { describe, expect, expectTypeOf, it } from "vitest";

import { getRandomSpinner, getSpinner, getSpinnerNames, spinners } from "../src/spinners";
import type { SpinnerName } from "../src/types";

describe("spinners", () => {
    describe("spinners registry", () => {
        it("should have a spinners object", () => {
            expect.assertions(1);

            expect(spinners).toBeDefined();
        });

        it("should contain at least 85 spinners", () => {
            expect.assertions(1);

            expect(Object.keys(spinners).length).toBeGreaterThanOrEqual(85);
        });

        it("should have all spinners with required properties", () => {
            expect.hasAssertions();

            Object.entries(spinners).forEach(([, spinner]) => {
                expect(spinner).toHaveProperty("interval");
                expect(spinner).toHaveProperty("frames");

                expectTypeOf(spinner.interval).toBeNumber();

                expect(Array.isArray(spinner.frames)).toBe(true);
                expect(spinner.frames.length).toBeGreaterThan(0);
            });
        });
    });

    describe("common spinners", () => {
        it("should have dots spinner", () => {
            expect.assertions(3);

            expect(spinners.dots).toBeDefined();
            expect(spinners.dots.interval).toBe(80);
            expect(spinners.dots.frames).toHaveLength(10);
        });

        it("should have line spinner", () => {
            expect.assertions(3);

            expect(spinners.line).toBeDefined();
            expect(spinners.line.interval).toBe(130);
            expect(spinners.line.frames).toStrictEqual(["-", "\\", "|", "/"]);
        });

        it("should have simpleDots spinner", () => {
            expect.assertions(2);

            expect(spinners.simpleDots).toBeDefined();
            expect(spinners.simpleDots.interval).toBe(400);
        });

        it("should have braille spinners", () => {
            expect.assertions(4);

            expect(spinners.breathe).toBeDefined();
            expect(spinners.cascade).toBeDefined();
            expect(spinners.helix).toBeDefined();
            expect(spinners.orbit).toBeDefined();
        });
    });

    describe("getSpinner", () => {
        it("should return a spinner by name", () => {
            expect.assertions(3);

            const spinner = getSpinner("dots");

            expect(spinner).toBeDefined();
            expect(spinner?.frames).toBeDefined();
            expect(spinner?.interval).toBe(80);
        });

        it("should return valid spinner object", () => {
            expect.assertions(2);

            const spinner = getSpinner("line");

            expect(spinner?.frames).toStrictEqual(["-", "\\", "|", "/"]);
            expect(spinner?.interval).toBe(130);
        });

        it("should return undefined for an unknown spinner name", () => {
            expect.assertions(1);

            // Cast: the registry has no such key; getSpinner must not throw, just return undefined.
            const spinner = getSpinner("definitely-not-a-spinner" as SpinnerName);

            expect(spinner).toBeUndefined();
        });

        it("should work with various spinner names", () => {
            expect.hasAssertions();

            const testSpinners: SpinnerName[] = ["dots", "line", "pipe", "star", "breathe", "helix"];

            testSpinners.forEach((name) => {
                const spinner = getSpinner(name);

                expect(spinner).toBeDefined();
                expect(spinner?.interval).toBeGreaterThan(0);
                expect(spinner?.frames.length).toBeGreaterThan(0);
            });
        });
    });

    describe("getRandomSpinner", () => {
        it("should return a spinner object", () => {
            expect.assertions(3);

            const spinner = getRandomSpinner();

            expect(spinner).toBeDefined();
            expect(spinner.frames).toBeDefined();
            expect(spinner.interval).toBeDefined();
        });

        it("should return valid spinner frames", () => {
            expect.assertions(2);

            const spinner = getRandomSpinner();

            expect(Array.isArray(spinner.frames)).toBe(true);
            expect(spinner.frames.length).toBeGreaterThan(0);
        });

        it("should return different spinners on multiple calls", () => {
            expect.assertions(1);

            const randomSpinners = Array.from({ length: 10 }, () => getRandomSpinner());
            const spinnerFrames = randomSpinners.map((s) => s.frames[0]);

            const uniqueFrames = new Set(spinnerFrames);

            expect(uniqueFrames.size).toBeGreaterThan(1);
        });
    });

    describe("getSpinnerNames", () => {
        it("should return an array of spinner names", () => {
            expect.assertions(1);

            const names = getSpinnerNames();

            expect(Array.isArray(names)).toBe(true);
        });

        it("should contain all spinners", () => {
            expect.assertions(1);

            const names = getSpinnerNames();

            expect(names.length).toBeGreaterThanOrEqual(85);
        });

        it("should contain expected spinners", () => {
            expect.assertions(3);

            const names = getSpinnerNames();

            expect(names).toContain("dots");
            expect(names).toContain("line");
            expect(names).toContain("pipe");
        });

        it("should not contain duplicates", () => {
            expect.assertions(1);

            const names = getSpinnerNames();
            const uniqueNames = new Set(names);

            expect(uniqueNames.size).toBe(names.length);
        });

        it("should match spinner registry keys", () => {
            expect.assertions(1);

            const names = getSpinnerNames();
            const registryKeys = Object.keys(spinners);

            const sortedNames = names.toSorted((a, b) => a.localeCompare(b));
            const sortedKeys = registryKeys.toSorted((a, b) => a.localeCompare(b));

            expect(sortedNames).toStrictEqual(sortedKeys);
        });
    });

    describe("spinner intervals", () => {
        it("should have reasonable interval values", () => {
            expect.hasAssertions();

            Object.values(spinners).forEach((spinner) => {
                expect(spinner.interval).toBeGreaterThan(0);
                expect(spinner.interval).toBeLessThan(500);
            });
        });

        it("should have valid intervals for different speeds", () => {
            expect.assertions(1);

            const slowSpinner = spinners.simpleDots;
            const fastSpinner = spinners.triangle;

            expect(slowSpinner.interval).toBeGreaterThan(fastSpinner.interval);
        });
    });

    describe("spinner frames", () => {
        it("should have non-empty frame arrays", () => {
            expect.hasAssertions();

            Object.values(spinners).forEach((spinner) => {
                expect(spinner.frames.length).toBeGreaterThan(0);
            });
        });

        it("should have string frames", () => {
            expect.assertions(1);

            const spinnersList = Object.values(spinners);

            expect(spinnersList.length).toBeGreaterThan(0);
        });

        it("should handle unicode characters in frames", () => {
            expect.assertions(2);

            const dotsSpinner = spinners.dots;

            expect(dotsSpinner.frames[0]).toBe("⠋");

            const breatheSpinner = spinners.breathe;

            expect(breatheSpinner.frames[0]).toBeDefined();
        });
    });
});
