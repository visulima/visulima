import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("default value", () => {
    it("default value", () => {
        expect.assertions(1);

        const defs = [{ name: "one" }, { defaultValue: "two", name: "two" }];
        const argv = ["--one", "1"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            one: "1",
            two: "two",
        });
    });

    it("default value 2", () => {
        expect.assertions(1);

        const defs = [{ defaultValue: "two", name: "two" }];
        const argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({ two: "two" });
    });

    it("default value 3", () => {
        expect.assertions(1);

        const defs = [{ defaultValue: "two", name: "two" }];
        const argv = ["--two", "zwei"];

        expect(commandLineArgs(defs, { argv })).toEqual({ two: "zwei" });
    });

    it("default value 4", () => {
        expect.assertions(1);

        const defs = [{ defaultValue: ["two", "zwei"], multiple: true, name: "two" }];
        const argv = ["--two", "duo"];

        expect(commandLineArgs(defs, { argv })).toEqual({ two: ["duo"] });
    });

    it("default value 5", () => {
        expect.assertions(1);

        const defs = [{ defaultValue: ["two", "zwei"], multiple: true, name: "two" }];
        const argv = [];
        const result = commandLineArgs(defs, { argv });

        expect(result).toStrictEqual({ two: ["two", "zwei"] });
    });

    it("default value: array as defaultOption", () => {
        expect.assertions(1);

        const defs = [{ defaultOption: true, defaultValue: ["two", "zwei"], multiple: true, name: "two" }];
        const argv = ["duo"];

        expect(commandLineArgs(defs, { argv })).toEqual({ two: ["duo"] });
    });

    it("default value: falsy default values", () => {
        expect.assertions(1);

        const defs = [
            { defaultValue: 0, name: "one" },
            { defaultValue: false, name: "two" },
        ];

        const argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({
            one: 0,
            two: false,
        });
    });

    it("default value: is arrayifed if multiple set", () => {
        expect.assertions(2);

        const defs = [{ defaultValue: 0, multiple: true, name: "one" }];

        let argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({
            one: [0],
        });

        argv = ["--one", "2"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            one: ["2"],
        });
    });

    it("default value: combined with defaultOption", () => {
        expect.assertions(3);

        const defs = [{ defaultOption: true, defaultValue: "./", name: "path" }];

        let argv = ["--path", "test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: "test",
        });

        argv = ["test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: "test",
        });

        argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: "./",
        });
    });

    it("default value: combined with multiple and defaultOption", () => {
        expect.assertions(5);

        const defs = [{ defaultOption: true, defaultValue: "./", multiple: true, name: "path" }];

        let argv = ["--path", "test1", "test2"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test1", "test2"],
        });

        argv = ["--path", "test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test"],
        });

        argv = ["test1", "test2"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test1", "test2"],
        });

        argv = ["test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test"],
        });

        argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["./"],
        });
    });

    it("default value: array default combined with multiple and defaultOption", () => {
        expect.assertions(5);

        const defs = [{ defaultOption: true, defaultValue: ["./"], multiple: true, name: "path" }];

        let argv = ["--path", "test1", "test2"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test1", "test2"],
        });

        argv = ["--path", "test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test"],
        });

        argv = ["test1", "test2"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test1", "test2"],
        });

        argv = ["test"];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["test"],
        });

        argv = [];

        expect(commandLineArgs(defs, { argv })).toEqual({
            path: ["./"],
        });
    });
});
