import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("default option", () => {
    it("multiple string", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, multiple: true, name: "files" }];
        const argv = ["file1", "file2"];

        expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
            files: ["file1", "file2"],
        });
    });

    it("after a boolean", () => {
        expect.assertions(1);

        const definitions = [
            { name: "one", type: Boolean },
            { defaultOption: true, name: "two" },
        ];

        expect(commandLineArgs(definitions, { argv: ["--one", "sfsgf"] }), { one: true, two: "sfsgf" });
    });

    it("multiple-defaultOption values spread out", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }, { name: "two" }, { defaultOption: true, multiple: true, name: "files" }];
        const argv = ["--one", "1", "file1", "file2", "--two", "2"];

        expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
            files: ["file1", "file2"],
            one: "1",
            two: "2",
        });
    });

    it("can be false", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: false, name: "one" },
            { defaultOption: false, name: "two" },
            { defaultOption: true, multiple: true, name: "files" },
        ];
        const argv = ["--one", "1", "file1", "file2", "--two", "2"];

        expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
            files: ["file1", "file2"],

            one: "1",
            two: "2",
        });
    });

    it("multiple-defaultOption values spread out 2", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Boolean }, { name: "two" }, { defaultOption: true, multiple: true, name: "files" }];
        const argv = ["file0", "--one", "file1", "--files", "file2", "--two", "2", "file3"];

        expect(commandLineArgs(optionDefinitions, { argv })).toEqual({
            files: ["file0", "file1", "file2", "file3"],
            one: true,
            two: "2",
        });
    });
});
