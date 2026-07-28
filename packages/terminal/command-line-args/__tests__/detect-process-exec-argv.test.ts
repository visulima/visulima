import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("detect process execArgv", () => {
    it("should parse process.argv.slice(2) without stripping exec args by value", () => {
        expect.assertions(1);

        const origArgv = process.argv;
        const origExecArgv = process.execArgv;

        // Node never interleaves execArgv entries into process.argv; slice(2) is
        // always the user arguments. A user argument that happens to equal an
        // exec flag must be preserved, not filtered away.
        process.argv = ["node", "script.js", "--one", "eins"];
        process.execArgv = ["-e", "something"];

        expect(commandLineArgs({ name: "one" })).toStrictEqual({
            one: "eins",
        });

        process.argv = origArgv;
        process.execArgv = origExecArgv;
    });

    it("should keep a user argument that is string-equal to an exec flag", () => {
        expect.assertions(1);

        const origArgv = process.argv;
        const origExecArgv = process.execArgv;

        process.argv = ["node", "script.js", "--one", "tsx"];
        process.execArgv = ["--import", "tsx"];

        expect(commandLineArgs({ name: "one" })).toStrictEqual({
            one: "tsx",
        });

        process.argv = origArgv;
        process.execArgv = origExecArgv;
    });
});
