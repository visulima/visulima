import { describe, expect, it } from "vitest";

import { analyzeCharacters } from "../src/checks/character";
import { isDisposableEmail } from "../src/checks/disposable";
import { isFreeEmail } from "../src/checks/free";
import { isNoReply, isRoleAccount } from "../src/checks/role";
import { analyzeSymbols } from "../src/checks/symbol";
import { validateSyntax } from "../src/checks/syntax";
import { detectTag } from "../src/checks/tag";

describe(validateSyntax, () => {
    it.each([
        ["user@example.com", true],
        ["john.doe@sub.example.co.uk", true],
        ["user+tag@example.com", true],
        ["", false],
        ["plainaddress", false],
        ["user@@example.com", false],
        ["user@example", false],
        ["user..name@example.com", false],
        [".user@example.com", false],
        ["user.@example.com", false],
        ["user@-example.com", false],
        ["user@example-.com", false],
        ["user@exa mple.com", false],
        ["user@foo_bar.com", false],
        ["user@exa!mple.com", false],
        ["user@xn--80ak6aa92e.com", true],
        ["user@münchen.de", true],
    ])("validateSyntax(%s) === %s", (email, expected) => {
        expect.assertions(1);

        expect(validateSyntax(email)).toBe(expected);
    });
});

describe(isDisposableEmail, () => {
    it("flags a known disposable domain", () => {
        expect.assertions(1);

        expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    });

    it("does not flag a normal domain", () => {
        expect.assertions(1);

        expect(isDisposableEmail("user@some-company-xyz.com")).toBe(false);
    });
});

describe(isFreeEmail, () => {
    it("flags a free provider", () => {
        expect.assertions(1);

        expect(isFreeEmail("user@gmail.com")).toBe(true);
    });

    it("does not flag a custom domain", () => {
        expect.assertions(1);

        expect(isFreeEmail("user@some-company-xyz.com")).toBe(false);
    });
});

describe(isRoleAccount, () => {
    it.each([
        ["info@example.com", true],
        ["support@example.com", true],
        ["no-reply@example.com", true],
        ["sales-team@example.com", true],
        ["sales.john@example.com", true],
        ["info+news@example.com", true],
        ["john.doe@example.com", false],
        ["jane@example.com", false],
    ])("isRoleAccount(%s) === %s", (email, expected) => {
        expect.assertions(1);

        expect(isRoleAccount(email)).toBe(expected);
    });

    it("honors custom prefixes", () => {
        expect.assertions(2);

        expect(isRoleAccount("press@example.com")).toBe(true);
        expect(isRoleAccount("custompref@example.com", ["custompref"])).toBe(true);
    });

    it("honors a single-pass iterable (generator) of custom prefixes across every sub-check", () => {
        expect.assertions(1);

        // A generator is exhausted after one iteration; the token-level check must
        // still see the custom prefix, which requires the iterable be materialized once.
        const generator = (function* customPrefixes() {
            yield "vip";
        })();

        expect(isRoleAccount("vip.john@example.com", generator)).toBe(true);
    });
});

describe(isNoReply, () => {
    it.each([
        ["no-reply@example.com", true],
        ["noreply@example.com", true],
        ["donotreply@example.com", true],
        ["notifications@example.com", true],
        ["info@example.com", false],
        ["john@example.com", false],
    ])("isNoReply(%s) === %s", (email, expected) => {
        expect.assertions(1);

        expect(isNoReply(email)).toBe(expected);
    });
});

describe(detectTag, () => {
    it("detects a plus tag", () => {
        expect.assertions(1);

        expect(detectTag("user+newsletter@gmail.com")).toStrictEqual({
            baseLocalPart: "user",
            hasTag: true,
            separator: "+",
            tag: "newsletter",
        });
    });

    it("detects a dash tag only for dash-subaddressing domains", () => {
        expect.assertions(2);

        expect(detectTag("user-news@fastmail.com").hasTag).toBe(true);
        expect(detectTag("user-news@gmail.com").hasTag).toBe(false);
    });

    it("reports no tag for a plain address", () => {
        expect.assertions(1);

        expect(detectTag("user@example.com")).toStrictEqual({ baseLocalPart: "user", hasTag: false });
    });
});

describe(analyzeCharacters, () => {
    it("flags digit-heavy machine-like locals", () => {
        expect.assertions(2);

        // eslint-disable-next-line no-secrets/no-secrets -- deliberately high-entropy local part for the heuristic under test
        const result = analyzeCharacters("xqzkwrtbplmn8475@example.com");

        expect(result.irregular).toBe(true);
        expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("does not flag a normal local part", () => {
        expect.assertions(1);

        expect(analyzeCharacters("john.doe@example.com").irregular).toBe(false);
    });

    it("flags long repeated characters", () => {
        expect.assertions(1);

        expect(analyzeCharacters("aaaaaa@example.com").reasons).toContain("repeated-character");
    });
});

describe(analyzeSymbols, () => {
    it("detects mixed scripts (homoglyph spoofing)", () => {
        expect.assertions(1);

        // "ра" here is Cyrillic.
        expect(analyzeSymbols("раypal@example.com").hasMixedScripts).toBe(true);
    });

    it("does not flag a legitimate IDN address (Latin local + non-Latin domain)", () => {
        expect.assertions(2);

        // Latin local part with a Han-script domain is a valid IDN, not a
        // homoglyph attack: the scripts live in separate segments.
        const result = analyzeSymbols("john@例子.公司");

        expect(result.hasMixedScripts).toBe(false);
        expect(result.hasNonAscii).toBe(true);
    });

    it("returns clean for plain ASCII", () => {
        expect.assertions(3);

        const result = analyzeSymbols("john@example.com");

        expect(result.hasNonAscii).toBe(false);
        expect(result.hasMixedScripts).toBe(false);
        expect(result.hasSymbols).toBe(false);
    });
});
