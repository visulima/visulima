import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("case insensitive", () => {
    it("disabled", () => {
        expect.assertions(1);
        expect.assertions(2);

        const optionDefinitions = [{ alias: "d", name: "dryRun", type: Boolean }];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["--DRYrun"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "--DRYrun",
        );
        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["-D"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "-D",
        );
    });

    it("option no value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "dryRun", type: Boolean }];
        const argv = ["--DRYrun"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result, {
            dryRun: true,
        });
    });

    it("option with value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "colour", type: String }];
        const argv = ["--coLour", "red"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result, {
            colour: "red",
        });
    });

    it("alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "d", name: "dryRun", type: Boolean }];
        const argv = ["-D"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result, {
            dryRun: true,
        });
    });

    it("multiple", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "colour", type: String }];
        const argv = ["--colour=red", "--COLOUR", "green", "--colOUR", "blue"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result, {
            colour: ["red", "green", "blue"],
        });
    });

    it("camelCase", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "dry-run", type: Boolean }];
        const argv = ["--dry-RUN"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true, caseInsensitive: true });

        expect(result, {
            dryRun: true,
        });
    });
});
