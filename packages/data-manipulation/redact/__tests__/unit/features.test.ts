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

    // A plain (non-wildcard) rule that resolves on a nested node is applied through the
    // direct-path branch of `recursivelyFilterAttributes`. That branch used to hand the censor
    // the bare rule key, so `{ user: { card } }` + a "card" rule reported "card" instead of
    // "user.card" — while wildcard rules already reported the full walked path. The censor's
    // documented `path` argument is the dot-path of the matched key, so these pin the joined
    // path for every branch that can reach a censor.
    it.each([
        ["a top-level key", { card: "x" }, "card", "card"],
        ["a nested key", { user: { card: "x" } }, "card", "user.card"],
        ["a deeply nested key", { a: { b: { c: { card: "x" } } } }, "card", "a.b.c.card"],
        ["a key inside an array element", { items: [{ card: "x" }] }, "card", "items.0.card"],
        ["a wildcard rule", { user: { cardNumber: "x" } }, "card*", "user.cardnumber"],
        ["a dotted rule on a nested node", { a: { user: { card: "x" } } }, "user.card", "a.user.card"],
    ])("passes the full walked dot-path to a censor for %s", (_name, input, key, expectedPath) => {
        expect.assertions(1);

        const seen: (string | undefined)[] = [];

        redact(input, [
            {
                key,
                replacement: (_value, path) => {
                    seen.push(path);

                    return "<MASKED>";
                },
            },
        ]);

        expect(seen).toStrictEqual([expectedPath]);
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

    it("supports a non-string replacement value", () => {
        expect.assertions(2);

        expect(redact({ secret: "x" }, [{ key: "secret", replacement: 0 }]).secret).toBe(0);
        expect(redact({ secret: "x" }, [{ key: "secret", replacement: false }]).secret).toBe(false);
    });

    it("falls back to the default placeholder for a nullish replacement", () => {
        expect.assertions(2);

        // `replacement` is resolved with `??`, so an explicit null/undefined is
        // treated as "not supplied" and the `<KEY>` default is used.
        expect(redact({ secret: "x" }, [{ key: "secret", replacement: null }]).secret).toBe("<SECRET>");
        expect(redact({ secret: "x" }, [{ key: "secret", replacement: undefined }]).secret).toBe("<SECRET>");
    });
});

describe("accessor properties", () => {
    it("materialises an own enumerable getter as its value", () => {
        expect.assertions(2);

        const input = {
            get password(): string {
                return "computed";
            },
            user: "alice",
        };

        const result = redact(input, ["password"]);

        expect(result.password).toBe("<PASSWORD>");
        expect(result.user).toBe("alice");
    });

    it("does not read prototype getters", () => {
        expect.assertions(1);

        // Only own properties are walked, so a prototype accessor is never invoked
        // and never lands on the copy — invoking it could have side effects.
        class WithAccessor {
            public user = "alice";

            // eslint-disable-next-line class-methods-use-this
            public get password(): string {
                return "computed";
            }
        }

        const result = redact(new WithAccessor(), ["password"]) as Record<string, unknown>;

        expect(Object.hasOwn(result, "password")).toBe(false);
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

    it("still applies pattern rules to text surrounding a URL", () => {
        expect.assertions(1);

        // The mere presence of "https://" must not route the whole string away from the
        // string anonymizer: a credit card sitting next to a URL is still redacted.
        const result = redact("see https://a.com and card 4111-1111-1111-1111", [
            { deep: true, key: "creditcard", pattern: String.raw`\b\d(?:[ -]?\d){12,18}\b` },
        ]);

        expect(result).toBe("see https://a.com and card <CREDITCARD>");
    });
});

describe("case-insensitive dotted-path rules", () => {
    it("matches a dotted-path rule against mixed-case keys", () => {
        expect.assertions(1);

        const result = redact({ User: { Pass: "hunter2" } }, ["user.pass"]);

        expect(result).toStrictEqual({ User: { Pass: "<USER.PASS>" } });
    });
});

describe("array index rules preserve later element paths", () => {
    it("keeps the parent dot-path for elements after a matched index", () => {
        expect.assertions(1);

        const result = redact({ list: ["a", "b", "c"] }, [0, { deep: true, key: "list.2" }]);

        expect(result).toStrictEqual({ list: ["<REDACTED>", "b", "<LIST.2>"] });
    });

    it("passes the full dot-path to a censor for elements after a matched index", () => {
        expect.assertions(1);

        const seen: (string | undefined)[] = [];

        redact({ list: ["a", "b"] }, [
            0,
            {
                deep: true,
                key: "list.1",
                replacement: (value, path) => {
                    seen.push(path);

                    return value;
                },
            },
        ]);

        expect(seen).toStrictEqual(["list.1"]);
    });
});

describe("map rule precedence", () => {
    it("lets a later, more specific rule override an earlier one for Map entries", () => {
        expect.assertions(1);

        const input = new Map<string, string>([["pass", "secret"]]);

        const result = redact(input, ["pass", { key: "pass", replacement: "X" }]);

        expect([...result]).toStrictEqual([["pass", "X"]]);
    });
});

describe("single-traversal behaviour", () => {
    it("evaluates every nested string against all deep rules in a single pass", () => {
        expect.assertions(2);

        let calls = 0;

        const countCall = (mask: string): string => {
            calls += 1;

            return mask;
        };

        // Two deep pattern rules that each match a different leaf string. In the old
        // O(rules x nodes) traversal the whole subtree was re-walked once per rule; in the
        // single-traversal model each leaf string is visited exactly once, so each censor
        // fires exactly once for its single matching leaf.
        const result = redact({ a: { aaa: "secret-token" }, b: { bbb: "another-secret" } }, [
            { deep: true, key: "x", pattern: String.raw`secret-token`, replacement: () => countCall("<X>") },
            { deep: true, key: "y", pattern: String.raw`another-secret`, replacement: () => countCall("<Y>") },
        ]);

        expect(result).toStrictEqual({ a: { aaa: "<X>" }, b: { bbb: "<Y>" } });
        expect(calls).toBe(2);
    });

    it("applies a plain key rule only where it resolves and does not descend into same-named nested keys", () => {
        expect.assertions(1);

        const input = {
            password: "top",
            user: { password: "nested" },
        };

        // A plain (non-deep, non-wildcard) `password` rule resolves at the root and must NOT
        // also redact `user.password`; deep/wildcard rules are required for that.
        const result = redact(input, ["password"]);

        expect(result).toStrictEqual({ password: "<PASSWORD>", user: { password: "nested" } });
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

    it("redacts a credential key and leaves the rest alone with credentialRules", () => {
        expect.assertions(2);

        const result = redact({ note: "public", password: "hunter2" }, credentialRules);

        expect(result.password).toBe("<PASSWORD>");
        expect(result.note).toBe("public");
    });

    it("masks a bearer token inside a nested string with credentialRules", () => {
        expect.assertions(1);

        const result = redact({ header: "Authorization: Bearer abc.def.ghi" }, credentialRules);

        expect(result.header).not.toContain("abc.def.ghi");
    });

    it("runs the aggregate standard rule set without throwing", () => {
        expect.assertions(2);

        // eslint-disable-next-line sonarjs/no-hardcoded-ip
        const result = redact({ card: "4111111111111111", ip: "192.168.0.1", password: "p" }, standardRules);

        expect(result.password).toBe("<PASSWORD>");
        expect(result.ip).toBeTypeOf("string");
    });
});

describe("top-level string inputs", () => {
    it("redacts a JSON string and returns JSON", () => {
        expect.assertions(1);

        const result = redact(String.raw`{"password":"p","user":"alice"}`, ["password"]);

        expect(JSON.parse(result)).toStrictEqual({ password: "<PASSWORD>", user: "alice" });
    });

    it("returns primitives that are not strings unchanged", () => {
        expect.assertions(4);

        expect(redact(42, ["password"])).toBe(42);
        expect(redact(true, ["password"])).toBe(true);
        expect(redact(null, ["password"])).toBeNull();
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(redact(undefined, ["password"])).toBeUndefined();
    });
});
