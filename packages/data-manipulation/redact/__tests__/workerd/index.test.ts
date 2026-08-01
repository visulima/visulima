import { describe, expect, it } from "vitest";

import { createRedactor, credentialRules, piiRules, redact, standardRules, stringAnonymize } from "../../src/index";

/**
 * The behavioural assertions live in `__tests__/unit/**`, which
 * `vitest.workerd.config.ts` also runs inside the isolate — so the redaction
 * rules, the walker, the censor contract and the rule sets are all verified
 * against workerd by their single definition.
 *
 * What is left here is what only workerd can answer: that the module graph
 * (including the sizeable `compromise` NLP dependency) loads in an isolate with
 * no `node:*` I/O, and that the walker copes with workerd's own host objects.
 */
describe("@visulima/redact on workerd", () => {
    describe("module graph", () => {
        it("should expose the whole public surface after loading in the isolate", () => {
            expect.assertions(2);

            expect([createRedactor, redact, stringAnonymize].every((exported) => typeof exported === "function")).toBe(true);
            expect([credentialRules, piiRules, standardRules].every((rules) => Array.isArray(rules) && rules.length > 0)).toBe(true);
        });

        it("should load the compromise NLP dependency inside the isolate", () => {
            expect.assertions(2);

            // `compromise` is a real runtime dependency pulled in lazily for NLP rules.
            // It is by far the largest thing in the graph, so a bundling or
            // `node:*`-resolution failure would surface here first.
            const output = stringAnonymize("write to alice@example.com today", [{ deep: true, key: "email" }]);

            expect(output).not.toContain("alice@example.com");
            expect(output).toContain("<EMAIL>");
        });
    });

    describe("workerd host objects", () => {
        it("should redact the entries lifted off a Headers instance", () => {
            expect.assertions(2);

            const headers = new Headers({ authorization: "Bearer abc.def.ghi", "x-request-id": "req-1" });
            const output = redact(Object.fromEntries(headers), ["authorization"]);

            expect(output.authorization).toBe("<AUTHORIZATION>");
            expect(output["x-request-id"]).toBe("req-1");
        });

        it("should redact a query string produced by the URL implementation", () => {
            expect.assertions(1);

            const url = new URL("https://api.test/v1");

            url.searchParams.set("access_token", "abc");
            url.searchParams.set("page", "2");

            // eslint-disable-next-line no-secrets/no-secrets -- the redacted placeholder this asserts on, not a real credential
            expect(redact(url.toString(), ["access_token"])).toContain("access_token=<ACCESS_TOKEN>");
        });
    });
});
