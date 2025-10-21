import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownOptionError } from "../src/errors";

describe("case insensitive", () => {
    it("disabled", () => {
        expect.assertions(2);

        const optionDefinitions = [{ alias: "d", name: "dryRun", type: Boolean }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--DRYrun"] })).toThrow(UnknownOptionError);
        expect(() => commandLineArgs(optionDefinitions, { argv: ["-D"] })).toThrow(UnknownOptionError);
    });

    it("option no value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "dryRun", type: Boolean }];
        const argv = ["--DRYrun"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            dryRun: true,
        });
    });

    it("option with value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "colour", type: String }];
        const argv = ["--coLour", "red"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            colour: "red",
        });
    });

    it("alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "d", name: "dryRun", type: Boolean }];
        const argv = ["-D"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            dryRun: true,
        });
    });

    it("multiple", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "colour", type: String }];
        const argv = ["--colour=red", "--COLOUR", "green", "--colOUR", "blue"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            colour: ["red", "green", "blue"],
        });
    });

    it("camelCase", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "dry-run", type: Boolean }];
        const argv = ["--dry-RUN"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true, caseInsensitive: true });

        expect(result).toStrictEqual({
            dryRun: true,
        });
    });

    it("short option group lowercase", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta", type: Boolean },
        ];
        const argv = ["-ab"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            alpha: true,
            beta: true,
        });
    });

    it("short option group uppercase", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta", type: Boolean },
        ];
        const argv = ["-AB"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            alpha: true,
            beta: true,
        });
    });

    it("short option group mixed case", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta", type: Boolean },
            { alias: "c", name: "gamma", type: Boolean },
        ];
        const argv = ["-AbC"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            alpha: true,
            beta: true,
            gamma: true,
        });
    });

    it("short option group all uppercase two chars", () => {
        expect.assertions(1);

        // Tests the specific case: -AB should normalize to -ab, not -aB
        const optionDefinitions = [
            { alias: "a", name: "flagA", type: Boolean },
            { alias: "b", name: "flagB", type: Boolean },
        ];
        const argv = ["-AB"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            flagA: true,
            flagB: true,
        });
    });

    it("short option group all uppercase three chars", () => {
        expect.assertions(1);

        // Tests the specific case: -ABC should normalize to -abc, not -aBc
        const optionDefinitions = [
            { alias: "a", name: "flagA", type: Boolean },
            { alias: "b", name: "flagB", type: Boolean },
            { alias: "c", name: "flagC", type: Boolean },
        ];
        const argv = ["-ABC"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({
            flagA: true,
            flagB: true,
            flagC: true,
        });
    });

    it("short option group with trailing value consumed correctly", () => {
        expect.assertions(1);

        // Tests that value-only tokens from short option groups are consumed
        const optionDefinitions = [
            { alias: "a", name: "alpha", type: Boolean },
            { alias: "b", name: "beta" },
        ];
        const argv = ["-ab", "value"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            alpha: true,
            beta: "value",
        });
    });
});
