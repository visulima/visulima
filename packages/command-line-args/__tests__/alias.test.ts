import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("alias", () => {
    it("one string alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "v", name: "verbose" }];
        const argv = ["-v"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            verbose: null,
        });
    });

    it("one boolean alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "d", name: "dry-run", type: Boolean }];
        const argv = ["-d"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            "dry-run": true,
        });
    });

    it("one boolean, one string", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "v", name: "verbose", type: Boolean },
            { alias: "c", name: "colour" },
        ];
        const argv = ["-v", "-c"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            colour: null,
            verbose: true,
        });
    });
});
