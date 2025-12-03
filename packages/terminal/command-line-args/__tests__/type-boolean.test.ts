import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

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
    });
});
