import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("exceptions unknowns", () => {
    it("unknown option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["--one", "--two"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "--two",
        );
    });

    it("1 unknown option, 1 unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["--one", "2", "--two", "two"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "--two",
        );
    });

    it("unknown alias", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["-a", "2"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "-a",
        );
    });

    it("unknown combined aliases", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one", type: Number }];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv: ["-sdf"] }),
            (error) => error.name === "UNKNOWN_OPTION" && error.optionName === "-s",
        );
    });

    it("unknown value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["--one", "arg1", "arg2"];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv }),
            (error) => error.name === "UNKNOWN_VALUE" && error.value === "arg2",
        );
    });

    it("unknown value with singular defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv }),

            (error) => error.name === "UNKNOWN_VALUE" && error.value === "arg2",
        );
    });

    it("no unknown value exception with multiple defaultOption", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultOption: true, multiple: true, name: "one" }];
        const argv = ["arg1", "arg2"];

        expect(() => () => {
            commandLineArgs(optionDefinitions, { argv });
        });
    });

    it("non-multiple defaultOption should take first value 2", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { defaultOption: true, name: "file" },
            { name: "one", type: Boolean },
            { name: "two", type: Boolean },
        ];
        const argv = ["--two", "file1", "--one", "file2"];

        expect(
            () => () => commandLineArgs(optionDefinitions, { argv }),
            (error) => error.name === "UNKNOWN_VALUE" && error.value === "file2",
        );
    });
});
