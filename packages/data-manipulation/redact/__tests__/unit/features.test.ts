import { describe, expect, it } from "vitest";

import { createRedactor, credentialRules, dateTimeRules, piiRules, redact, standardRules } from "../../src";

describe("input mutation safety", () => {
    it("does not stamp internal markers onto the input object", () => {
        expect.assertions(2);

        const input = { password: "secret", user: "alice" };

        redact(input, ["password"]);

        // The previous implementation stamped __redact_circular_reference__ onto every visited object.
        expect(Object.keys(input)).toStrictEqual(["password", "user"]);
        expect((input as Record<string, unknown>).__redact_circular_reference__).toBeUndefined();
    });

    it("redacts a frozen input object without throwing", () => {
        expect.assertions(2);

        const input = Object.freeze({ password: "secret", user: "alice" });

        let result: typeof input;

        expect(() => {
            result = redact(input, ["password"]);
        }).not.toThrow();

        // @ts-expect-error result is assigned in the callback above
        expect(result).toStrictEqual({ password: "<PASSWORD>", user: "alice" });
    });

    it("does not leak markers when a censor function throws mid-walk", () => {
        expect.assertions(1);

        const input = { a: { b: 1 }, password: "secret" };

        const thrower = () => {
            throw new Error("boom");
        };

        try {
            redact(input, [{ key: "password", replacement: thrower }]);
        } catch {
            // ignore
        }

        expect((input as Record<string, unknown>).__redact_circular_reference__).toBeUndefined();
    });

    it("still handles circular references without infinite recursion", () => {
        expect.assertions(2);

        const input: Record<string, unknown> = { password: "secret" };

        input.self = input;

        // A deep rule forces traversal into `self`; the WeakMap must short-circuit the cycle
        // and the copy's self-reference must point back at the copy (not the original).
        const result = redact(input, [{ deep: true, key: "password" }]);

        expect(result.password).toBe("<PASSWORD>");
        expect(result.self).toBe(result);
    });
});

describe("censor / partial masking", () => {
    it("invokes a function replacement with the value and path", () => {
        expect.assertions(2);

        const seen: { path: string | undefined; value: unknown }[] = [];

        const result = redact({ card: "4111111111111111" }, [
            {
                key: "card",
                replacement: (value, path) => {
                    seen.push({ path, value });

                    return `****${String(value).slice(-4)}`;
                },
            },
        ]);

        expect(result).toStrictEqual({ card: "****1111" });
        expect(seen).toStrictEqual([{ path: "card", value: "4111111111111111" }]);
    });

    it("applies a censor function via a pattern rule on a string", () => {
        expect.assertions(1);

        // Use a non-NLP key so only the custom pattern rule fires (NLP `email` would otherwise compete).
        const result = redact("contact me at john@example.com", [
            {
                deep: true,
                key: "contact",
                pattern: String.raw`[a-z]+@[a-z.]+`,
                replacement: (value) => `***@${String(value).split("@")[1] ?? ""}`,
            },
        ]);

        expect(result).toBe("contact me at ***@example.com");
    });
});

describe("remove option", () => {
    it("deletes a matching key instead of replacing it", () => {
        expect.assertions(1);

        const result = redact({ keep: 1, secret: "x" }, [{ key: "secret", remove: true }]);

        expect(result).toStrictEqual({ keep: 1 });
    });

    it("removes nested keys via deep matching", () => {
        expect.assertions(1);

        const result = redact({ outer: { keep: 2, token: "abc" } }, [{ key: "token", remove: true }]);

        expect(result).toStrictEqual({ outer: { keep: 2 } });
    });

    it("removes a dotted-path key", () => {
        expect.assertions(1);

        const result = redact({ a: { b: 1, secret: "x" } }, [{ key: "a.secret", remove: true }]);

        expect(result).toStrictEqual({ a: { b: 1 } });
    });

    it("removes a key from a Map", () => {
        expect.assertions(1);

        const input = new Map<string, unknown>([
            ["keep", 1],
            ["secret", "x"],
        ]);

        const result = redact(input, [{ key: "secret", remove: true }]);

        expect([...result.entries()]).toStrictEqual([["keep", 1]]);
    });
});

describe(createRedactor, () => {
    it("returns a reusable redactor that produces the same output as redact", () => {
        expect.assertions(2);

        const scrub = createRedactor(["password"]);

        expect(scrub({ password: "a", user: "x" })).toStrictEqual({ password: "<PASSWORD>", user: "x" });
        expect(scrub({ password: "b" })).toStrictEqual({ password: "<PASSWORD>" });
    });

    it("honours exclude at compile time", () => {
        expect.assertions(1);

        const scrub = createRedactor(["password", "token"], { exclude: ["token"] });

        expect(scrub({ password: "a", token: "b" })).toStrictEqual({ password: "<PASSWORD>", token: "b" });
    });
});

describe("url query redaction with wildcard and pattern rules", () => {
    it("redacts a query parameter via a wildcard rule", () => {
        expect.assertions(2);

        const result = redact("https://api.test/path?access_token=abc123&keep=1", ["*token*"]);

        expect(result).toContain("access_token=");
        expect(result).not.toContain("abc123");
    });

    it("still matches exact query parameter rules", () => {
        expect.assertions(2);

        const result = redact("https://api.test/path?password=hunter2", ["password"]);

        expect(result).toContain("password=");
        expect(result).not.toContain("hunter2");
    });
});

describe("themed rule subsets", () => {
    it("exposes credential, pii and dateTime subsets that compose into the default set", () => {
        expect.assertions(2);

        expect(standardRules).toHaveLength(credentialRules.length + piiRules.length + dateTimeRules.length);

        // credentialRules alone should not enable the weekday/date overmatching.
        const result = redact("met on monday", [...credentialRules]);

        expect(result).toBe("met on monday");
    });
});
