import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("grouping", () => {
    it("groups", () => {
        expect.assertions(1);

        const definitions = [
            { group: "a", name: "one" },
            { group: "a", name: "two" },
            { group: "b", name: "three" },
        ];
        const argv = ["--one", "1", "--two", "2", "--three", "3"];
        const output = commandLineArgs(definitions, { argv });

        expect(output, {
            _all: {
                one: "1",
                three: "3",
                two: "2",
            },
            a: {
                one: "1",
                two: "2",
            },
            b: {
                three: "3",
            },
        });
    });

    it("multiple and _none", () => {
        expect.assertions(1);

        const definitions = [{ group: ["a", "f"], name: "one" }, { group: ["a", "g"], name: "two" }, { name: "three" }];

        expect(commandLineArgs(definitions, { argv: ["--one", "1", "--two", "2", "--three", "3"] })).toEqual({
            _all: {
                one: "1",
                three: "3",
                two: "2",
            },
            _none: {
                three: "3",
            },
            a: {
                one: "1",
                two: "2",
            },
            f: {
                one: "1",
            },
            g: {
                two: "2",
            },
        });
    });

    it("nothing set", () => {
        expect.assertions(1);

        const definitions = [
            { group: "a", name: "one" },
            { group: "a", name: "two" },
            { group: "b", name: "three" },
        ];
        const argv = [];
        const output = commandLineArgs(definitions, { argv });

        expect(output, {
            _all: {},
            a: {},
            b: {},
        });
    });

    it("nothing set with one ungrouped", () => {
        expect.assertions(1);

        const definitions = [{ group: "a", name: "one" }, { group: "a", name: "two" }, { name: "three" }];
        const argv = [];
        const output = commandLineArgs(definitions, { argv });

        expect(output, {
            _all: {},
            a: {},
        });
    });

    it("two ungrouped, one set", () => {
        expect.assertions(1);

        const definitions = [{ group: "a", name: "one" }, { group: "a", name: "two" }, { name: "three" }, { name: "four" }];
        const argv = ["--three", "3"];
        const output = commandLineArgs(definitions, { argv });

        expect(output, {
            _all: { three: "3" },
            _none: { three: "3" },
            a: {},
        });
    });

    it("two ungrouped, both set", () => {
        expect.assertions(1);

        const definitions = [{ group: "a", name: "one" }, { group: "a", name: "two" }, { name: "three" }, { name: "four" }];
        const argv = ["--three", "3", "--four", "4"];
        const output = commandLineArgs(definitions, { argv });

        expect(output, {
            _all: { four: "4", three: "3" },
            _none: { four: "4", three: "3" },
            a: {},
        });
    });

    it("with partial", () => {
        expect.assertions(1);

        const definitions = [
            { group: "a", name: "one" },
            { group: "a", name: "two" },
            { group: "b", name: "three" },
        ];
        const argv = ["--one", "1", "--two", "2", "--three", "3", "ham", "--cheese"];

        expect(commandLineArgs(definitions, { argv, partial: true })).toEqual({
            _all: {
                one: "1",
                three: "3",
                two: "2",
            },
            _unknown: ["ham", "--cheese"],
            a: {
                one: "1",
                two: "2",
            },
            b: {
                three: "3",
            },
        });
    });

    it("partial: with partial, multiple groups and _none", () => {
        expect.assertions(1);

        const definitions = [{ group: ["a", "f"], name: "one" }, { group: ["a", "g"], name: "two" }, { name: "three" }];
        const argv = ["--cheese", "--one", "1", "ham", "--two", "2", "--three", "3", "-c"];

        expect(commandLineArgs(definitions, { argv, partial: true })).toEqual({
            _all: {
                one: "1",
                three: "3",
                two: "2",
            },
            _none: {
                three: "3",
            },
            _unknown: ["--cheese", "ham", "-c"],
            a: {
                one: "1",
                two: "2",
            },
            f: {
                one: "1",
            },
            g: {
                two: "2",
            },
        });
    });
});
