import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("ambiguous input", () => {
    it("value looks like an option 1", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "c", name: "colour", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["-c", "red"] })).toStrictEqual({
            colour: "red",
        });
    });

    it("value looks like an option 2", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "c", name: "colour", type: String }];
        const argv = ["--colour", "--red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("value looks like an option 3", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "c", name: "colour", type: String }];
        const argv = ["--colour=--red"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            colour: "--red",
        });
    });

    it("value looks like an option 4", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "c", name: "colour", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--colour=--red"] })).toStrictEqual({
            colour: "--red",
        });
    });
});
