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

        expect(Date.now() - start).toBeLessThan(5000);
    });

    it("does not hang on a long adversarial url-like string", () => {
        expect.assertions(1);

        const adversarial = "a.".repeat(3000);

        const start = Date.now();

        stringAnonymize(adversarial, standardModifierRules);

        expect(Date.now() - start).toBeLessThan(5000);
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

        expect(Date.now() - start).toBeLessThan(5000);
        expect(result).toContain("abc");
    });
});

describe("mask substitution safety", () => {
    it("does not let a `$` sequence in a tag splice the redacted value back into the output", () => {
        expect.assertions(3);

        // `String.prototype.replace` expands `$&`, `` $` `` and `$'` in the REPLACEMENT string.
        // Masks are built from the tag, so an unescaped one would echo the surrounding text —
        // including the very value being masked — straight back into "redacted" output.
        const scan = (tag: string) => stringAnonymize("AAA SECRET BBB", ["x"], { nlp: () => [{ start: 4, tag, text: "SECRET" }] });

        expect(scan("$&")).toBe("AAA <$&> BBB");
        expect(scan("$'")).toBe("AAA <$'> BBB");
        expect(scan("$`")).toBe("AAA <$`> BBB");
    });

    it("does not let a `$` sequence in a rule key splice the value back either", () => {
        expect.assertions(1);

        expect(stringAnonymize("AAA SECRET BBB", [{ key: "$&", pattern: "SECRET" }])).toBe("AAA <$&> BBB");
    });
});

describe("untrusted scanner", () => {
    it("propagates a throwing scanner rather than emitting the unredacted string", () => {
        expect.assertions(1);

        // Failing closed is the point: swallowing the error here would return `input` verbatim
        // to whatever sink the caller is about to write to.
        expect(() =>
            redact({ note: "sensitive" }, ["firstname"], {
                nlp: () => {
                    throw new Error("scanner blew up");
                },
            }),
        ).toThrow("scanner blew up");
    });
});
