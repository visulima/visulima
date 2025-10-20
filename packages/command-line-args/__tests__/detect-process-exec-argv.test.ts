import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("detect process execArgv", () => {
    it("should automatically remove first argv items", () => {
        expect.assertions(1);

        const origArgv = process.argv;
        const origExecArgv = process.execArgv;

        process.argv = ["node", "--one", "eins"];
        process.execArgv = ["-e", "something"];

        expect(commandLineArgs({ name: "one" })).toStrictEqual({
            one: "eins",
        });

        process.argv = origArgv;
        process.execArgv = origExecArgv;
    });
});
