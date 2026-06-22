import { describe, expect, it } from "vitest";

import createTranslator from "../src/i18n/create-translator";

const FORMAT_ERROR_PATTERN = /Failed to format message "likes"/;

const messages = {
    de_DE: { likes: "{count, plural, one {# Like} other {# Likes}}" },
    en: { greeting: "Hi {name}", likes: "{count, plural, one {# like} other {# likes}}" },
};

describe(createTranslator, () => {
    it("formats ICU plurals for the requested locale", () => {
        expect.assertions(2);

        const t = createTranslator({ fallbackLocale: "en", messages });

        expect(t.translate("de_DE", "likes", { count: 3 })).toBe("3 Likes");
        expect(t.translate("en", "likes", { count: 1 })).toBe("1 like");
    });

    it("interpolates values", () => {
        expect.assertions(1);

        const t = createTranslator({ fallbackLocale: "en", messages });

        expect(t.translate("en", "greeting", { name: "Ada" })).toBe("Hi Ada");
    });

    it("falls back region -> language -> fallback locale", () => {
        expect.assertions(2);

        const t = createTranslator({ fallbackLocale: "en", messages });

        // de-AT has no table; language "de" has no table either, so it falls back to en.
        expect(t.translate("fr", "likes", { count: 2 })).toBe("2 likes");
        // de_DE region table is used directly.
        expect(t.translate("de_DE", "likes", { count: 1 })).toBe("1 Like");
    });

    it("returns the key when missing everywhere, or a custom onMissing", () => {
        expect.assertions(2);

        const plain = createTranslator({ fallbackLocale: "en", messages });

        expect(plain.translate("en", "unknown.key")).toBe("unknown.key");

        const custom = createTranslator({ fallbackLocale: "en", messages, onMissing: (_locale, key) => `?${key}?` });

        expect(custom.translate("en", "unknown.key")).toBe("?unknown.key?");
    });

    it("reports key presence via has()", () => {
        expect.assertions(2);

        const t = createTranslator({ fallbackLocale: "en", messages });

        expect(t.has("de_DE", "likes")).toBe(true);
        expect(t.has("en", "nope")).toBe(false);
    });

    it("throws an actionable error when ICU values are missing", () => {
        expect.assertions(1);

        const t = createTranslator({ fallbackLocale: "en", messages });

        expect(() => t.translate("en", "likes", {})).toThrow(FORMAT_ERROR_PATTERN);
    });
});
