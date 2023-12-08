import { describe, it, expect } from "vitest";

import findAlternatives from "../../../src/util/levenstein";

describe("util/levenstein", () => {
    it("should find an approximate match within the Levenshtein distance", () => {
        const string = "command";
        const array = ["commnd", "comman", "cmand"];

        const result = findAlternatives(string, array);

        expect(result).toEqual(["commnd", "comman"]);
    });

    it("should find a string which includes the given string", () => {
        const string = "command";
        const array = ["mycommand", "exactcommand", "commandtest"];

        const result = findAlternatives(string, array);

        expect(result).toEqual(["mycommand"]);
    });

    it("should return an empty array if no strings are similar", () => {
        const string = "command";
        const array = ["test", "something", "anything"];

        const result = findAlternatives(string, array);

        expect(result).toEqual([]);
    });
});
