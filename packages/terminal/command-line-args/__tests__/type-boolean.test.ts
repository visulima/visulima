import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { UnknownOptionError } from "../src/errors";

describe("type boolean", () => {
    describe("boolean type handling", () => {
        it("type-boolean: simple", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one"] })).toStrictEqual({ one: true });
        });

        const origBoolean = Boolean;

        /* test in contexts which override the standard global Boolean constructor */
        it("type-boolean: global Boolean overridden", () => {
            expect.assertions(1);

            // eslint-disable-next-line sonarjs/no-globals-shadowing
            const Boolean = (...args: any[]) => origBoolean.apply(origBoolean, args);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one"] })).toStrictEqual({ one: true });
        });

        it("type-boolean-multiple: 1", () => {
            expect.assertions(1);

            const optionDefinitions = [{ multiple: true, name: "array", type: Boolean }];
            const argv = ["--array", "--array", "--array"];
            const result = commandLineArgs(optionDefinitions, { argv });

            expect(result).toStrictEqual({
                array: [true, true, true],
            });
        });

        it("type-boolean: inline =true resolves to true", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one=true"] })).toStrictEqual({ one: true });
        });

        it("type-boolean: inline =false resolves to false", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one=false"] })).toStrictEqual({ one: false });
        });

        it("type-boolean: inline with any other value resolves to true", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one=yes"] })).toStrictEqual({ one: true });
        });

        it("type-boolean: short option inline =false resolves to false", () => {
            expect.assertions(1);

            const optionDefinitions = [{ alias: "o", name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["-o=false"] })).toStrictEqual({ one: false });
        });

        it("type-boolean: empty inline value throws in strict mode", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(() => commandLineArgs(optionDefinitions, { argv: ["--one="] })).toThrow(UnknownOptionError);
        });

        it("type-boolean: empty inline value in partial mode keeps the raw token in _unknown", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one="], partial: true })).toStrictEqual({
                _unknown: ["--one="],
                one: true,
            });
        });

        it("type-boolean: repeated non-multiple flag in partial mode collects into an array", () => {
            expect.assertions(1);

            const optionDefinitions = [{ name: "one", type: Boolean }];

            expect(commandLineArgs(optionDefinitions, { argv: ["--one", "--one"], partial: true })).toStrictEqual({
                one: [true, true],
            });
        });
    });
});
