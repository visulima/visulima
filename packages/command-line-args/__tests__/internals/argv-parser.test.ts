import { describe, expect, it } from "vitest";

import ArgvParser from "../../src/lib/argv-parser";

describe("argv parser", () => {
    it("long option, string", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one", "1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
        ]);
    });

    it("long option, string repeated", () => {
        expect.assertions(5);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one", "1", "--one", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "2", event: "set", name: "one", value: "2" },
        ]);
    });

    it("long option, string multiple", () => {
        expect.assertions(4);

        const optionDefinitions = [{ multiple: true, name: "one" }];
        const argv = ["--one", "1", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "2", event: "set", name: "one", value: "2" },
        ]);
    });

    it("long option, string multiple then boolean", () => {
        expect.assertions(5);

        const optionDefinitions = [
            { multiple: true, name: "one" },
            { name: "two", type: Boolean },
        ];
        const argv = ["--one", "1", "2", "--two"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "2", event: "set", name: "one", value: "2" },
            { arg: "--two", event: "set", name: "two", value: true },
        ]);
    });

    it("long option, boolean", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one", type: Boolean }];
        const argv = ["--one", "1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: true },
            { arg: "1", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("simple, with unknown values", () => {
        expect.assertions(5);

        const optionDefinitions = [{ name: "one", type: Number }];
        const argv = ["clive", "--one", "1", "yeah"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeUndefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "clive", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "yeah", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("simple, with singular defaultOption", () => {
        expect.assertions(5);

        const optionDefinitions = [
            { name: "one", type: Number },
            { defaultOption: true, name: "two" },
        ];
        const argv = ["clive", "--one", "1", "yeah"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "clive", event: "set", name: "two", value: "clive" },
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "yeah", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("simple, with multiple defaultOption", () => {
        expect.assertions(5);

        const optionDefinitions = [
            { name: "one", type: Number },
            { defaultOption: true, multiple: true, name: "two" },
        ];
        const argv = ["clive", "--one", "1", "yeah"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "clive", event: "set", name: "two", value: "clive" },
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "yeah", event: "set", name: "two", value: "yeah" },
        ]);
    });

    it("long option, string lazyMultiple bad", () => {
        expect.assertions(4);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one", "1", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "2", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("long option, string lazyMultiple good", () => {
        expect.assertions(5);

        const optionDefinitions = [{ lazyMultiple: true, name: "one" }];
        const argv = ["--one", "1", "--one", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();
        expect(result[3].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "2", event: "set", name: "one", value: "2" },
        ]);
    });

    it("long option, stopAtFirstUnknown", () => {
        expect.assertions(4);

        const optionDefinitions = [{ name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "asdf", "--two", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv, stopAtFirstUnknown: true });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "asdf", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "--two", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "2", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("long option, stopAtFirstUnknown with defaultOption", () => {
        expect.assertions(5);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["1", "asdf", "--two", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv, stopAtFirstUnknown: true });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeUndefined();
        expect(result[2].def).toBeUndefined();
        expect(result[3].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "asdf", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "--two", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "2", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("long option, stopAtFirstUnknown with defaultOption 2", () => {
        expect.assertions(6);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const parser = new ArgvParser(optionDefinitions, { argv, stopAtFirstUnknown: true });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeUndefined();
        expect(result[3].def).toBeUndefined();
        expect(result[4].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
            { arg: "--", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "--two", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "2", event: "unknown_value", name: "_unknown", value: undefined },
        ]);
    });

    it("--option=value", () => {
        expect.assertions(4);

        const optionDefinitions = [{ name: "one" }, { name: "two" }];
        const argv = ["--one=1", "--two=2", "--two="];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one=1", event: "set", name: "one", value: "1" },
            { arg: "--two=2", event: "set", name: "two", value: "2" },
            { arg: "--two=", event: "set", name: "two", value: "" },
        ]);
    });

    it("--option=value, unknown option", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--three=3"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeUndefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([{ arg: "--three=3", event: "unknown_option", name: "_unknown", value: undefined }]);
    });

    it("--option=value where option is boolean", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one", type: Boolean }];
        const argv = ["--one=1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "--one=1", event: "unknown_value", name: "_unknown", value: undefined },
            { arg: "--one=1", event: "set", name: "one", value: true },
        ]);
    });

    it("short option, string", () => {
        expect.assertions(3);

        const optionDefinitions = [{ alias: "o", name: "one" }];
        const argv = ["-o", "1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "-o", event: "set", name: "one", value: null },
            { arg: "1", event: "set", name: "one", value: "1" },
        ]);
    });

    it("combined short option, string", () => {
        expect.assertions(4);

        const optionDefinitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
        ];
        const argv = ["-ot", "1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeDefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "-ot", event: "set", name: "one", subArg: "-o", value: null },
            { arg: "-ot", event: "set", name: "two", subArg: "-t", value: null },
            { arg: "1", event: "set", name: "two", value: "1" },
        ]);
    });

    it("combined short option, one unknown", () => {
        expect.assertions(4);

        const optionDefinitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
        ];
        const argv = ["-xt", "1"];
        const parser = new ArgvParser(optionDefinitions, { argv });
        const result = [...parser];

        expect(result[0].def).toBeUndefined();
        expect(result[1].def).toBeDefined();
        expect(result[2].def).toBeDefined();

        result.forEach((r) => delete r.def);

        expect(result).toStrictEqual([
            { arg: "-xt", event: "unknown_option", name: "_unknown", subArg: "-x", value: undefined },
            { arg: "-xt", event: "set", name: "two", subArg: "-t", value: null },
            { arg: "1", event: "set", name: "two", value: "1" },
        ]);
    });
});
