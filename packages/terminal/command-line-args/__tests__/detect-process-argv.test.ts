import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("detect process argv", () => {
    it("should automatically remove first two argv items", () => {
        expect.assertions(1);

        process.argv = ["node", "filename", "--one", "eins"];

        expect(commandLineArgs({ name: "one" })).toStrictEqual({
            one: "eins",
        });
    });

    it("should automatically remove first two argv items 2", () => {
        expect.assertions(1);

        process.argv = ["node", "filename", "--one", "eins"];

        expect(commandLineArgs({ name: "one" }, { argv: process.argv.slice(2) })).toStrictEqual({
            one: "eins",
        });
    });

    it("process.argv is left untouched", () => {
        expect.assertions(2);

        process.argv = ["node", "filename", "--one", "eins"];

        expect(commandLineArgs({ name: "one" })).toStrictEqual({
            one: "eins",
        });
        expect(process.argv).toStrictEqual(["node", "filename", "--one", "eins"]);
    });
});
