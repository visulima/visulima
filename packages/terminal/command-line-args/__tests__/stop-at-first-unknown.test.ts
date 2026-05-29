import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("stop at first unknown", () => {
    it("stopAtFirstUnknown", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { name: "one", type: Boolean },
            { name: "two", type: Boolean },
        ];
        const argv = ["--one", "a", "--two"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["a", "--two"],
            one: true,
        });
    });

    it("with a singular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });

    it("with a singular defaultOption and partial", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }, { name: "two" }];
        const argv = ["--one", "1", "--", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--", "--two", "2"],
            one: "1",
        });
    });

    it("should parse known options after a defaultOption positional value", () => {
        expect.assertions(1);

        // Simulates: `cli run build --root=/tmp --parallel=5`
        // The defaultOption captures "build" as the positional argument.
        // Known options --root and --parallel should still be parsed, not dropped.
        const optionDefinitions = [
            { defaultOption: true, multiple: true, name: "target" },
            { name: "root", type: String },
            { name: "parallel", type: Number },
        ];
        const argv = ["build", "--root", "/tmp", "--parallel", "5"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            parallel: 5,
            root: "/tmp",
            target: ["build"],
        });
    });

    it("should parse known options before and after a defaultOption positional value", () => {
        expect.assertions(1);

        // Simulates: `cli run --parallel=5 build --root=/tmp`
        // Options should be parsed regardless of position relative to positional args.
        const optionDefinitions = [
            { defaultOption: true, multiple: true, name: "target" },
            { name: "root", type: String },
            { name: "parallel", type: Number },
        ];
        const argv = ["--parallel", "5", "build", "--root", "/tmp"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            parallel: 5,
            root: "/tmp",
            target: ["build"],
        });
    });

    it("should still stop at truly unknown options after a defaultOption positional value", () => {
        expect.assertions(1);

        // Known options after the positional should be parsed,
        // but truly unknown options should trigger stop behavior.
        const optionDefinitions = [
            { defaultOption: true, multiple: true, name: "target" },
            { name: "root", type: String },
        ];
        const argv = ["build", "--root", "/tmp", "--unknown-flag", "value"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--unknown-flag", "value"],
            root: "/tmp",
            target: ["build"],
        });
    });

    it("should handle options with = notation after a defaultOption positional value", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, multiple: true, name: "target" },
            { name: "root", type: String },
        ];
        const argv = ["build", "--root=/tmp/workspace"];
        const result = commandLineArgs(optionDefinitions, { argv, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            root: "/tmp/workspace",
            target: ["build"],
        });
    });

    it("should parse camelCase options after a defaultOption positional value", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, multiple: true, name: "target" },
            { name: "cache-dir", type: String },
            { name: "dry-run", type: Boolean },
        ];
        const argv = ["build", "--cache-dir", "/tmp", "--dry-run"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true, partial: true, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            cacheDir: "/tmp",
            dryRun: true,
            target: ["build"],
        });
    });

    it("stops at an unknown option even when there are no unconsumed positionals", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Boolean }];
        const argv = ["--one", "--unknown"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["--unknown"],
            one: true,
        });
    });

    it("with short option group should use correct argv index", () => {
        expect.assertions(1);

        // Test that stopAtFirstUnknown uses token.index (argv position) not token array index
        // When -ab is tokenized, it creates multiple tokens but they map to argv index 0
        // The _unknown should slice from the correct argv position
        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta", type: Boolean },
        ];
        const argv = ["-ab", "unknown"];
        const result = commandLineArgs(optionDefinitions, { argv, stopAtFirstUnknown: true });

        expect(result).toStrictEqual({
            _unknown: ["unknown"],
            alpha: true,
            beta: true,
        });
    });
});
