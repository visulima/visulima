import { describe, expect, it } from "vitest";

import { closestString } from "../../src/closest-string";

describe(closestString, () => {
    it("closestString() handles basic example", () => {
        expect.assertions(1);

        const givenWord = "request";
        const possibleWords = ["response", "require", "receipt", "sequester"];

        expect(closestString(givenWord, possibleWords)).toBe("require");
    });

    it("closestString() handles case sensitive example 1", () => {
        expect.assertions(1);

        const givenWord = "Component";
        const possibleWords = ["component", "Complement", "Comportment"];

        expect(closestString(givenWord, possibleWords, { caseSensitive: true })).toBe("component");
    });

    it("closestString() handles case sensitive example 2", () => {
        expect.assertions(1);

        const givenWord = "Event";
        const possibleWords = ["EVENT", "Evert", "Prevent"];

        expect(closestString(givenWord, possibleWords, { caseSensitive: true })).toBe("Evert");
    });

    it("closestString() handles empty input", () => {
        expect.assertions(1);

        expect(() => closestString("he", [])).toThrow(
            "When using closestString(), the possibleWords array must contain at least one word",
        );
    });
});
