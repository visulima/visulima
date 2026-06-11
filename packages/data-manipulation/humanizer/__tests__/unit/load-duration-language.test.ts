import { describe, expect, it } from "vitest";

import duration from "../../src/duration";
import loadDurationLanguage from "../../src/load-duration-language";

describe(loadDurationLanguage, () => {
    it("should load a language pack by code", async () => {
        expect.assertions(2);

        const de = await loadDurationLanguage("de");

        expect(de.future).toBeDefined();
        expect(duration(3_600_000, { language: de })).toBe("1 Stunde");
    });

    it("should load a language pack with an underscore variant code", async () => {
        expect.assertions(1);

        const zh = await loadDurationLanguage("zh_CN");

        expect(zh.future).toBeDefined();
    });

    it("should reject an empty code", async () => {
        expect.assertions(1);

        await expect(loadDurationLanguage("")).rejects.toThrow("A non-empty locale code string is required.");
    });

    it("should reject an invalid code", async () => {
        expect.assertions(1);

        await expect(loadDurationLanguage("../secret")).rejects.toThrow("Invalid locale code");
    });

    it("should throw when no language pack exists for the code", async () => {
        expect.assertions(1);

        await expect(loadDurationLanguage("zzz")).rejects.toThrow("No duration language pack found");
    });
});
