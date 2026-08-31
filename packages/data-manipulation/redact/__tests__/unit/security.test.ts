import { describe, expect, it } from "vitest";

import { redact, stringAnonymize } from "../../src";
import { compromiseScanner } from "../../src/nlp";
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

        // A zero-width pattern necessarily peppers the output with masks — it matches between
        // every character. What matters is that it terminates, and that the digits it did
        // legitimately match are gone.
        expect(result).not.toContain("123");
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

describe("masking is applied at the matched offset", () => {
    it("masks the occurrence that was matched, not the first one that looks like it", () => {
        expect.assertions(2);

        // Regression: replacement used to search for the first occurrence of the matched text.
        // compromise tags only the surname inside "John Doe" here, so the match had to land on
        // the SECOND "Doe" — the first-occurrence search rewrote the leading word instead and
        // left the real surname in the clear.
        const result = stringAnonymize("Doe met John Doe yesterday", ["firstname", "lastname"], { nlp: compromiseScanner });

        expect(result).toBe("Doe met <FIRSTNAME> <LASTNAME> yesterday");
        expect(result.slice(result.indexOf("met"))).not.toContain("Doe");
    });

    it("honours a scanner's per-match offsets over an earlier identical string", () => {
        expect.assertions(1);

        // Same property without compromise: the scanner reports the SECOND "secret" only, so the
        // first must survive and the second must be masked.
        const result = stringAnonymize("secret and secret", ["x"], {
            nlp: () => [{ start: 11, tag: "x", text: "secret" }],
        });

        expect(result).toBe("secret and <X>");
    });

    it("drops an overlapping match instead of letting it rewrite a later occurrence", () => {
        expect.assertions(1);

        // `email` and `url` both match an address at the same offset. The first rule wins; the
        // loser must not go hunting for some other occurrence of the same text.
        const result = stringAnonymize("mail bob@example.com or bob@example.com", [
            { deep: true, key: "email", pattern: String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}` },
            { deep: true, key: "url", pattern: String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}` },
        ]);

        expect(result).toBe("mail <EMAIL> or <EMAIL>");
    });
});
