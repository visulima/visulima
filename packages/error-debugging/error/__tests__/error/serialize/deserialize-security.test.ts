import { describe, expect, it } from "vitest";

import { deserializeError, serializeError } from "../../../src";

describe("deserializeError security", () => {
    it("should not replace the error prototype via a __proto__ payload key", () => {
        expect.assertions(3);

        const payload: unknown = JSON.parse("{\"name\":\"Error\",\"message\":\"x\",\"__proto__\":{\"isAdmin\":true}}");
        const error = deserializeError(payload);

        // Must remain a real Error (prototype not replaced by attacker data).
        expect(error).toBeInstanceOf(Error);
        expect((error as unknown as Record<string, unknown>).isAdmin).toBeUndefined();
        // Global prototype must not be polluted.
        expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it("should not pollute Object.prototype via a nested __proto__ payload key", () => {
        expect.assertions(2);

        const payload: unknown = JSON.parse("{\"name\":\"Error\",\"message\":\"x\",\"extra\":{\"__proto__\":{\"polluted\":true}}}");

        deserializeError(payload);

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.prototype).not.toHaveProperty("polluted");
    });

    it("should ignore constructor/prototype payload keys", () => {
        expect.assertions(2);

        const payload: unknown = JSON.parse("{\"name\":\"Error\",\"message\":\"x\",\"constructor\":{\"evil\":true},\"prototype\":{\"evil\":true}}");
        const error = deserializeError(payload) as unknown as Record<string, unknown>;

        expect(error.constructor).toBe(Error);
        expect(error.prototype).toBeUndefined();
    });
});

describe("serialize/deserialize round-trip for Map/Set/RegExp/URL", () => {
    it("should serialize and restore a Map property", () => {
        expect.assertions(2);

        const error = new Error("boom") as Error & { data: Map<string, number> };

        error.data = new Map([
            ["a", 1],
            ["b", 2],
        ]);

        const serialized = serializeError(error);

        // Survives JSON.stringify (not collapsed to {}) — JSON round-trip is intentional here.
        // eslint-disable-next-line unicorn/prefer-structured-clone
        const roundTrippedJson = JSON.parse(JSON.stringify(serialized)) as Record<string, unknown>;

        expect(roundTrippedJson.data).toStrictEqual({
            __dataType: "Map",
            value: [
                ["a", 1],
                ["b", 2],
            ],
        });

        const restored = deserializeError(roundTrippedJson) as unknown as { data: Map<string, number> };

        expect(restored.data).toStrictEqual(
            new Map([
                ["a", 1],
                ["b", 2],
            ]),
        );
    });

    it("should serialize and restore a Set property", () => {
        expect.assertions(2);

        const error = new Error("boom") as Error & { tags: Set<string> };

        error.tags = new Set(["x", "y"]);

        // eslint-disable-next-line unicorn/prefer-structured-clone
        const serialized = JSON.parse(JSON.stringify(serializeError(error))) as Record<string, unknown>;

        expect(serialized.tags).toStrictEqual({ __dataType: "Set", value: ["x", "y"] });

        const restored = deserializeError(serialized) as unknown as { tags: Set<string> };

        expect(restored.tags).toStrictEqual(new Set(["x", "y"]));
    });

    it("should serialize a RegExp property to its string form", () => {
        expect.assertions(1);

        const error = new Error("boom") as Error & { pattern: RegExp };

        error.pattern = /\d+/gu;

        const serialized = serializeError(error) as unknown as { pattern: unknown };

        expect(serialized.pattern).toBe(String.raw`/\d+/gu`);
    });

    it("should serialize a URL property to its href", () => {
        expect.assertions(1);

        const error = new Error("boom") as Error & { url: URL };

        error.url = new URL("https://example.com/path?q=1");

        const serialized = serializeError(error) as unknown as { url: unknown };

        expect(serialized.url).toBe("https://example.com/path?q=1");
    });
});
