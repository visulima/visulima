import { describe, expect, it } from "vitest";

import findAlternatives from "../../../src/util/general/find-alternatives";

describe("util/levenstein", () => {
    it("should find an approximate match within the Levenshtein distance", () => {
        expect.assertions(1);

        const string = "command";
        const array = ["commnd", "comman", "cmand"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(["commnd", "comman"]);
    });

    it("should find a string which includes the given string", () => {
        expect.assertions(1);

        const string = "command";
        const array = ["mycommand", "exactcommand", "commandtest"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(["mycommand"]);
    });

    it("should return an empty array if no strings are similar", () => {
        expect.assertions(1);

        const string = "command";
        const array = ["test", "something", "anything"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual([]);
    });
});
