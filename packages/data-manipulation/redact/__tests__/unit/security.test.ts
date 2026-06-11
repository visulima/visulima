import { describe, expect, it } from "vitest";

import { redact, stringAnonymize } from "../../src";
import standardModifierRules from "../../src/rules";

describe("redos resistance", () => {
    it("linearized credit-card rule still redacts a real card number", () => {
        expect.assertions(1);

        const result = stringAnonymize("card 4111 1111 1111 1111 here", standardModifierRules);

        expect(result).toContain("<CREDITCARD>");
    });

    it("does not hang on a long adversarial digit/separator string (creditcard)", () => {
        expect.assertions(1);

        // A string of digits + separators that, with the old nested-quantifier pattern,
        // caused polynomial backtracking. With the linearized pattern it returns quickly.
        const adversarial = `${"1 ".repeat(2000)}x`;

        const start = Date.now();

        stringAnonymize(adversarial, standardModifierRules);

        expect(Date.now() - start).toBeLessThan(2000);
    });

    it("does not hang on a long adversarial url-like string", () => {
        expect.assertions(1);

        const adversarial = "a.".repeat(3000);

        const start = Date.now();

        stringAnonymize(adversarial, standardModifierRules);

        expect(Date.now() - start).toBeLessThan(2000);
    });

    it("linearized url rule still redacts a normal url-like host", () => {
        expect.assertions(1);

        const urlRule = standardModifierRules.find((rule) => typeof rule === "object" && rule.key === "url") as { pattern: string };

        const result = stringAnonymize("visit example.com today", [{ deep: true, key: "url", pattern: urlRule.pattern }]);

        expect(result).toContain("<URL>");
    });
});

describe("zero-width match guard", () => {
    it("does not hang when a user rule pattern can match an empty string", () => {
        expect.assertions(2);

        const start = Date.now();

        // `\d*` matches the empty string at every position; without the lastIndex guard
        // rx.exec would loop forever.
        const result = redact("abc 123 def", [{ deep: true, key: "num", pattern: String.raw`\d*`, replacement: "<N>" }]);

        expect(Date.now() - start).toBeLessThan(2000);
        expect(result).toContain("abc");
    });
});
