/* eslint-disable vitest/prefer-expect-assertions */
import { describe, expect, expectTypeOf, it } from "vitest";

import { getRandomSpinner, getSpinner, getSpinnerNames, spinners } from "../src/spinners";
import type { SpinnerFrame } from "../src/types";

describe("spinners", () => {
    describe("spinners registry", () => {
        it("should have a spinners object", () => {
            expect(spinners).toBeDefined();

            expectTypeOf(spinners).toBeObject();
        });

        it("should contain at least 85 spinners", () => {
            expect(Object.keys(spinners).length).toBeGreaterThanOrEqual(85);
        });

        it("should have all spinners with required properties", () => {
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
            expect(spinners.dots).toBeDefined();
            expect(spinners.dots.interval).toBe(80);
            expect(spinners.dots.frames).toHaveLength(10);
        });

        it("should have line spinner", () => {
            expect(spinners.line).toBeDefined();
            expect(spinners.line.interval).toBe(130);
            expect(spinners.line.frames).toStrictEqual(["-", "\\", "|", "/"]);
        });

        it("should have simpleDots spinner", () => {
            expect(spinners.simpleDots).toBeDefined();
            expect(spinners.simpleDots.interval).toBe(400);
        });

        it("should have braille spinners", () => {
            expect(spinners.breathe).toBeDefined();
            expect(spinners.cascade).toBeDefined();
            expect(spinners.helix).toBeDefined();
            expect(spinners.orbit).toBeDefined();
        });
    });

    describe("getSpinner", () => {
        it("should return a spinner by name", () => {
            const spinner = getSpinner("dots");

            expect(spinner).toBeDefined();
            expect(spinner?.frames).toBeDefined();
            expect(spinner?.interval).toBe(80);
        });

        it("should return undefined for non-existent spinner", () => {
            const spinner = getSpinner("non-existent-spinner");

            expect(spinner).toBeUndefined();
        });

        it("should return valid spinner object", () => {
            const spinner = getSpinner("line") as SpinnerFrame;

            expect(spinner.frames).toStrictEqual(["-", "\\", "|", "/"]);
            expect(spinner.interval).toBe(130);
        });

        it("should work with various spinner names", () => {
            const testSpinners = ["dots", "line", "pipe", "star", "breathe", "helix"];

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
            const spinner = getRandomSpinner();

            expect(spinner).toBeDefined();
            expect(spinner.frames).toBeDefined();
            expect(spinner.interval).toBeDefined();
        });

        it("should return valid spinner frames", () => {
            const spinner = getRandomSpinner();

            expect(Array.isArray(spinner.frames)).toBe(true);
            expect(spinner.frames.length).toBeGreaterThan(0);

            expectTypeOf(spinner.interval).toBeNumber();
        });

        it("should return different spinners on multiple calls", () => {
            const randomSpinners = Array.from({ length: 10 }, () => getRandomSpinner());
            const spinnerFrames = randomSpinners.map((s) => s.frames[0]);

            // With 70+ spinners, it's extremely unlikely to get all the same
            const uniqueFrames = new Set(spinnerFrames);

            expect(uniqueFrames.size).toBeGreaterThan(1);
        });
    });

    describe("getSpinnerNames", () => {
        it("should return an array of spinner names", () => {
            const names = getSpinnerNames();

            expect(Array.isArray(names)).toBe(true);
        });

        it("should contain all spinners", () => {
            const names = getSpinnerNames();

            expect(names.length).toBeGreaterThanOrEqual(85);
        });

        it("should contain expected spinners", () => {
            const names = getSpinnerNames();

            expect(names).toContain("dots");
            expect(names).toContain("line");
            expect(names).toContain("pipe");
        });

        it("should not contain duplicates", () => {
            const names = getSpinnerNames();
            const uniqueNames = new Set(names);

            expect(uniqueNames.size).toBe(names.length);
        });

        it("should match spinner registry keys", () => {
            const names = getSpinnerNames();
            const registryKeys = Object.keys(spinners);

            const sortedNames = names.toSorted((a, b) => a.localeCompare(b));
            const sortedKeys = registryKeys.toSorted((a, b) => a.localeCompare(b));

            expect(sortedNames).toStrictEqual(sortedKeys);
        });
    });

    describe("spinner intervals", () => {
        it("should have reasonable interval values", () => {
            Object.values(spinners).forEach((spinner) => {
                expect(spinner.interval).toBeGreaterThan(0);
                expect(spinner.interval).toBeLessThan(500);
            });
        });

        it("should have valid intervals for different speeds", () => {
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
            const spinnersList = Object.values(spinners);

            expect(spinnersList.length).toBeGreaterThan(0);

            spinnersList.forEach((spinner) => {
                spinner.frames.forEach((frame) => {
                    expectTypeOf(frame).toBeString();
                });
            });
        });

        it("should handle unicode characters in frames", () => {
            const dotsSpinner = spinners.dots;

            expect(dotsSpinner.frames[0]).toBe("⠋");

            const breatheSpinner = spinners.breathe;

            expect(breatheSpinner.frames[0]).toBeDefined();
        });
    });
});
