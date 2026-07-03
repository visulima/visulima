import { describe, expect, it } from "vitest";

import findAlternatives from "../../../src/util/general/find-alternatives";

describe("util/levenstein (find-alternatives)", () => {
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

    it("should handle case-insensitive matching", () => {
        expect.assertions(2);

        const string = "COMMAND";
        const array = ["command", "Command", "COMMAND"];

        const result = findAlternatives(string, array);

        expect(result).toHaveLength(3);
        expect(result).toStrictEqual(["command", "Command", "COMMAND"]);
    });

    it("should handle empty array", () => {
        expect.assertions(1);

        const string = "command";
        const array: string[] = [];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual([]);
    });

    it("should handle empty string", () => {
        expect.assertions(1);

        const string = "";
        const array = ["test", "command"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual([]);
    });

    it("should filter out strings with large length differences", () => {
        expect.assertions(1);

        const string = "cmd";
        const array = ["verylongcommandname", "cmd", "c"];

        const result = findAlternatives(string, array);

        // Should include "cmd" and "c" but not "verylongcommandname" due to length difference
        expect(result).toStrictEqual(["cmd", "c"]);
    });

    it("should find multiple similar strings", () => {
        expect.assertions(4);

        const string = "build";
        const array = ["buil", "buid", "bild", "test"];

        const result = findAlternatives(string, array);

        expect(result).toHaveLength(3);
        expect(result).toContain("buil");
        expect(result).toContain("buid");
        expect(result).toContain("bild");
    });
});
