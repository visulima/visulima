import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("alias cluster", () => {
    describe("alias clustering", () => {
        it("two flags, one option", () => {
            expect.assertions(1);

            const optionDefinitions = [
                { alias: "a", name: "flagA", type: Boolean },
                { alias: "b", name: "flagB", type: Boolean },
                { alias: "c", name: "three" },
            ];

            const argv = ["-abc", "yeah"];

            expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
                flagA: true,
                flagB: true,
                three: "yeah",
            });
        });

        it("two flags, one option 2", () => {
            expect.assertions(1);

            const optionDefinitions = [
                { alias: "a", name: "flagA", type: Boolean },
                { alias: "b", name: "flagB", type: Boolean },
                { alias: "c", name: "three" },
            ];

            const argv = ["-c", "yeah", "-ab"];

            expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
                flagA: true,
                flagB: true,
                three: "yeah",
            });
        });

        it("three string options", () => {
            expect.assertions(1);

            const optionDefinitions = [
                { alias: "a", name: "flagA" },
                { alias: "b", name: "flagB" },
                { alias: "c", name: "three" },
            ];

            const argv = ["-abc", "yeah"];

            expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
                flagA: null,
                flagB: null,
                three: "yeah",
            });
        });
    });
});
