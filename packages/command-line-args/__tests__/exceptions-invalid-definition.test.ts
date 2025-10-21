import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("exceptions invalid definition", () => {
    it("throws when no definition.name specified", () => {
        expect.assertions(1);

        const optionDefinitions = [{ something: "one" }, { something: "two" }];
        const argv = ["--one", "--two"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("throws if dev set a numeric alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "1", name: "colours" }];
        const argv = ["--colours", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("throws if dev set an alias of \"-\"", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "-", name: "colours" }];
        const argv = ["--colours", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("multi-character alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "aa", name: "one" }];
        const argv = ["--one", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("invalid type values 1", () => {
        expect.assertions(1);

        const argv = ["--one", "something"];

        expect(() => commandLineArgs([{ name: "one", type: "string" }], { argv })).toThrow();
    });

    it("invalid type values 2", () => {
        expect.assertions(1);

        const argv = ["--one", "something"];

        expect(() => commandLineArgs([{ name: "one", type: 234 }], { argv })).toThrow();
    });

    it("invalid type values 3", () => {
        expect.assertions(1);

        const argv = ["--one", "something"];

        expect(() => commandLineArgs([{ name: "one", type: {} }], { argv })).toThrow();
    });

    it("invalid type values 4", () => {
        expect.assertions(1);

        const argv = ["--one", "something"];

        expect(() => {
            commandLineArgs([{ name: "one", type: () => {} }], { argv });
        }).toThrow(/invalid/i);
    });

    it("duplicate name", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "colours" }, { name: "colours" }];
        const argv = ["--colours", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("duplicate name caused by case insensitivity", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "colours" }, { name: "coloURS" }];
        const argv = ["--colours", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv, caseInsensitive: true })).toThrow();
    });

    it("case sensitive names in different case", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "colours" }, { name: "coloURS" }];
        const argv = ["--colours", "red", "--coloURS", "green"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            colours: "red",
            coloURS: "green",
        });
    });

    it("duplicate alias", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "one" },
            { alias: "a", name: "two" },
        ];
        const argv = ["--one", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("duplicate alias caused by case insensitivity", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "one" },
            { alias: "A", name: "two" },
        ];
        const argv = ["-a", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv, caseInsensitive: true })).toThrow();
    });

    it("case sensitive aliases in different case", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "one" },
            { alias: "A", name: "two" },
        ];
        const argv = ["-a", "red"];

        expect(commandLineArgs(optionDefinitions, { argv })).toStrictEqual({
            one: "red",
        });
    });

    it("multiple defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, name: "one" },
            { defaultOption: true, name: "two" },
        ];
        const argv = ["--one", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("multiple defaultOptions 2", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: undefined, name: "one" },
            { defaultOption: false, name: "two" },
            { defaultOption: true, multiple: true, name: "files" },
            { defaultOption: true, name: "files2" },
        ];
        const argv = ["--one", "1", "file1", "file2", "--two", "2"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });

    it("defaultOption on a Boolean type", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one", type: Boolean }];
        const argv = ["--one", "red"];

        expect(() => commandLineArgs(optionDefinitions, { argv })).toThrow();
    });
});
