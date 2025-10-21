import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { AlreadySetError } from "../src/errors";

describe("exceptions already set", () => {
    it("long option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Boolean }];
        const argv = ["--one", "--one"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(AlreadySetError);
    });

    it("short option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "o", name: "one", type: Boolean }];
        const argv = ["--one", "-o"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(AlreadySetError);
    });

    it("--option=value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one=1", "--one=1"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(AlreadySetError);
    });

    it("combined short option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "o", name: "one", type: Boolean }];
        const argv = ["-oo"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow(AlreadySetError);
    });
});
