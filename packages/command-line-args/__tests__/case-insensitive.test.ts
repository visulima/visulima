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
});
