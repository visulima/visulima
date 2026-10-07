import { describe, expect, it } from "vitest";

import generateMessageId from "../../src/utils/generate-message-id";

describe(generateMessageId, () => {
    it("should use the sender's domain", () => {
        expect.assertions(1);

        // eslint-disable-next-line e18e/prefer-static-regex
        expect(generateMessageId("hello@mail.example.com")).toMatch(/^<[\da-f-]{36}@mail\.example\.com>$/);
    });

    it("should fall back to localhost without a usable sender", () => {
        expect.assertions(2);

        // eslint-disable-next-line e18e/prefer-static-regex
        expect(generateMessageId()).toMatch(/^<[\da-f-]{36}@localhost>$/);
        // eslint-disable-next-line e18e/prefer-static-regex
        expect(generateMessageId("no-domain@")).toMatch(/@localhost>$/);
    });

    it("should generate unique message IDs", () => {
        expect.assertions(1);

        expect(generateMessageId("a@example.com")).not.toBe(generateMessageId("a@example.com"));
    });
});
