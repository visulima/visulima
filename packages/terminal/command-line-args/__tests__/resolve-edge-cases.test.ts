import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("resolve edge cases", () => {
    it("camelCase applies to default values for unset options", () => {
        expect.assertions(1);

        const optionDefinitions = [{ defaultValue: "fallback", name: "out-dir" }];
        const result = commandLineArgs(optionDefinitions, { argv: [], camelCase: true });

        expect(result).toStrictEqual({ outDir: "fallback" });
    });

    it("camelCase keys are placed into their groups via the reverse map", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { group: "build", name: "out-dir" },
            { group: "build", name: "min-ify", type: Boolean },
        ];
        const argv = ["--out-dir", "dist", "--min-ify"];
        const result = commandLineArgs(optionDefinitions, { argv, camelCase: true });

        expect(result).toStrictEqual({
            _all: {
                minIfy: true,
                outDir: "dist",
            },
            build: {
                minIfy: true,
                outDir: "dist",
            },
        });
    });

    it("skips prototype-polluting group names while keeping safe groups", () => {
        expect.assertions(1);

        const optionDefinitions = [
            { group: "__proto__", name: "one" },
            { group: "safe", name: "two" },
        ];
        const argv = ["--one", "1", "--two", "2"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            _all: {
                one: "1",
                two: "2",
            },
            safe: {
                two: "2",
            },
        });
    });

    it("ignores a prototype-polluting group while attaching to its safe sibling group", () => {
        expect.assertions(1);

        const optionDefinitions = [{ group: ["constructor", "valid"], name: "one" }];
        const argv = ["--one", "1"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            _all: {
                one: "1",
            },
            valid: {
                one: "1",
            },
        });
    });

    it("case-insensitive matching resolves an alias supplied in a different case", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "v", name: "verbose", type: Boolean }];
        const argv = ["-V"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true });

        expect(result).toStrictEqual({ verbose: true });
    });

    it("treats a bare '-=value' as unknown under case-insensitive normalization", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "one" }];
        const argv = ["-=foo"];
        const result = commandLineArgs(optionDefinitions, { argv, caseInsensitive: true, partial: true });

        expect(result).toStrictEqual({ _unknown: ["-=foo"] });
    });
});
