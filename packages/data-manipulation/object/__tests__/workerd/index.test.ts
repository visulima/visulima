import { describe, expect, it } from "vitest";

import { deepKeys, deepKeysFromList, deleteProperty, escapePath, getProperty, hasProperty, isPlainObject, omit, pick, setProperty } from "../../src/index";

/**
 * The package's behavioural assertions live in `__tests__/*.test.ts` and
 * `__tests__/utils/**`, which `vitest.workerd.config.ts` also runs inside the
 * isolate — so `pick`, `omit` and the re-exported helpers are already verified
 * against workerd by their single definition.
 *
 * What is left here is what only workerd can answer: that the module graph
 * resolves at all in the isolate, and that `isPlainObject` classifies workerd's
 * own host objects the way it classifies Node's.
 */
describe("@visulima/object on workerd", () => {
    describe("module graph", () => {
        it("should expose the whole public surface after loading in the isolate", () => {
            expect.assertions(1);

            const surface = { deepKeys, deepKeysFromList, deleteProperty, escapePath, getProperty, hasProperty, isPlainObject, omit, pick, setProperty };

            expect(Object.values(surface).every((exported) => typeof exported === "function")).toBe(true);
        });
    });

    describe("workerd host objects", () => {
        it("should reject workerd-native objects that carry a toStringTag", () => {
            expect.assertions(3);

            // These are host objects implemented by the runtime, not by V8, so their
            // prototype chain and well-known symbols are a runtime detail. `pick`/`omit`
            // must treat them as opaque here exactly as they do in Node.
            expect(isPlainObject(new Headers())).toBe(false);
            expect(isPlainObject(new URLSearchParams())).toBe(false);
            expect(isPlainObject(new Request("https://example.test"))).toBe(false);
        });

        it("should keep a workerd host object by reference instead of copying it", () => {
            expect.assertions(2);

            const headers = new Headers({ authorization: "Bearer x" });
            const result = pick({ headers, other: 1 }, ["headers"]);

            expect(result.headers).toBe(headers);
            expect(result.headers.get("authorization")).toBe("Bearer x");
        });
    });
});
