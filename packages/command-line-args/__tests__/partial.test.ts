import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("partial", () => {
    it("simple", () => {
        expect.assertions(1);

        const definitions = [{ name: "one", type: Boolean }];
        const argv = ["--two", "two", "--one", "two"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--two", "two", "two"],
            one: true,
        });
    });

    it("defaultOption", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, multiple: true, name: "files", type: String }];
        const argv = ["--files", "file1", "--one", "file2"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--one"],
            files: ["file1", "file2"],
        });
    });

    it("defaultOption: floating args present but no defaultOption", () => {
        expect.assertions(1);

        const definitions = [{ name: "one", type: Boolean }];

        expect(commandLineArgs(definitions, { argv: ["aaa", "--one", "aaa", "aaa"], partial: true })).toStrictEqual({
            _unknown: ["aaa", "aaa", "aaa"],
            one: true,
        });
    });

    it("combined short option, both unknown", () => {
        expect.assertions(1);

        const definitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
        ];
        const argv = ["-ab"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["-a", "-b"],
        });
    });

    it("combined short option, one known, one unknown", () => {
        expect.assertions(1);

        const definitions = [
            { alias: "o", name: "one" },
            { alias: "t", name: "two" },
        ];
        const argv = ["-ob"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["-b"],
            one: null,
        });
    });

    it("defaultOption with --option=value and combined short options", () => {
        expect.assertions(1);

        const definitions = [
            { defaultOption: true, multiple: true, name: "files", type: String },
            { name: "one", type: Boolean },
            { alias: "t", defaultValue: 2, name: "two" },
        ];
        const argv = ["file1", "--one", "file2", "-t", "--two=3", "file3", "-ab"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["-a", "-b"],
            files: ["file1", "file2", "file3"],
            one: true,
            two: "3",
        });
    });

    it("defaultOption with value equal to defaultValue", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, defaultValue: "file1", name: "file", type: String }];
        const argv = ["file1", "--two=3", "--four", "5"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--two=3", "--four", "5"],
            file: "file1",
        });
    });

    it("string defaultOption can be set by argv once", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, defaultValue: "file1", name: "file", type: String }];
        const argv = ["--file", "--file=file2", "--two=3", "--four", "5"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--two=3", "--four", "5"],
            file: "file2",
        });
    });

    it("string defaultOption can not be set by argv twice", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, defaultValue: "file1", name: "file", type: String }];
        const argv = ["--file", "--file=file2", "--two=3", "--four", "5", "file3"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--two=3", "--four", "5", "file3"],
            file: "file2",
        });
    });

    it("defaultOption with value equal to defaultValue 3", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, defaultValue: "file1", name: "file", type: String }];
        const argv = ["file1", "file2", "--two=3", "--four", "5"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["file2", "--two=3", "--four", "5"],
            file: "file1",
        });
    });

    it("multiple", () => {
        expect.assertions(1);

        const definitions = [{ multiple: true, name: "files", type: String }];
        const argv = ["file1", "--files", "file2", "-t", "--two=3", "file3", "-ab", "--files=file4"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["file1", "-t", "--two=3", "file3", "-a", "-b"],
            files: ["file2", "file4"],
        });
    });

    it("unknown options: rejected defaultOption values end up in _unknown", () => {
        expect.assertions(1);

        const definitions = [
            { name: "foo", type: String },
            { alias: "v", name: "verbose", type: Boolean },
            { defaultOption: true, name: "libs", type: String },
        ];
        const argv = ["--foo", "bar", "-v", "libfn", "--libarg", "val1", "-r"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--libarg", "val1", "-r"],
            foo: "bar",
            libs: "libfn",
            verbose: true,
        });
    });

    it("defaultOption with --option=value notation", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, multiple: true, name: "files", type: String }];
        const argv = ["file1", "file2", "--unknown=something"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--unknown=something"],
            files: ["file1", "file2"],
        });
    });

    it("defaultOption with --option=value notation 2", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, multiple: true, name: "files", type: String }];
        const argv = ["file1", "file2", "--unknown=something", "--files", "file3", "--files=file4"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--unknown=something"],
            files: ["file1", "file2", "file3", "file4"],
        });
    });

    it("defaultOption with --option=value notation 3", () => {
        expect.assertions(1);

        const definitions = [{ defaultOption: true, multiple: true, name: "files", type: String }];
        const argv = ["--unknown", "file1", "--another", "something", "file2", "--unknown=something", "--files", "file3", "--files=file4"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--unknown", "--another", "--unknown=something"],
            files: ["file1", "something", "file2", "file3", "file4"],
        });
    });

    it("mulitple unknowns with same name", () => {
        expect.assertions(1);

        const definitions = [{ name: "file" }];
        const argv = ["--unknown", "--unknown=something", "--file=file1", "--unknown"];
        const options = commandLineArgs(definitions, { argv, partial: true });

        expect(options).toStrictEqual({
            _unknown: ["--unknown", "--unknown=something", "--unknown"],
            file: "file1",
        });
    });

    it("defaultOption: single string", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "files" }];
        const argv = ["file1", "file2"];

        expect(commandLineArgs(optionDefinitions, { argv, partial: true })).toStrictEqual({
            _unknown: ["file2"],
            files: "file1",
        });
    });
});
