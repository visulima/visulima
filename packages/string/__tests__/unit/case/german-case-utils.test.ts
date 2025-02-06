import { describe, expect, it } from "vitest";

import { germanUpperSsToSz } from "../../../src/case/german-case-utils";

describe("germanUpperSsToSz", () => {
    it("should convert uppercase SS to ß in German text", () => {
        expect(germanUpperSsToSz("STRASSE", "de")).toBe("STRAßE");
        expect(germanUpperSsToSz("GROSSE", "de-DE")).toBe("GROßE");
        expect(germanUpperSsToSz("WEISS", "de-AT")).toBe("WEIß");
    });

    it("should not convert SS in non-German text", () => {
        expect(germanUpperSsToSz("STRASSE", "en")).toBe("STRASSE");
        expect(germanUpperSsToSz("GROSSE", "fr")).toBe("GROSSE");
        expect(germanUpperSsToSz("WEISS", "tr")).toBe("WEISS");
    });

    it("should not convert lowercase or mixed case ss", () => {
        expect(germanUpperSsToSz("strasse", "de")).toBe("strasse");
        expect(germanUpperSsToSz("Strasse", "de")).toBe("Strasse");
        expect(germanUpperSsToSz("straSSe", "de")).toBe("straSSe");
    });

    it("should handle array of locales", () => {
        expect(germanUpperSsToSz("STRASSE", ["en", "de"])).toBe("STRAßE");
        expect(germanUpperSsToSz("GROSSE", ["fr", "de-DE"])).toBe("GROßE");
        expect(germanUpperSsToSz("WEISS", ["tr", "en"])).toBe("WEISS");
    });

    it("should handle empty or undefined locale", () => {
        expect(germanUpperSsToSz("STRASSE")).toBe("STRASSE");
        expect(germanUpperSsToSz("GROSSE", [])).toBe("GROSSE");
    });

    it("should handle multiple SS occurrences", () => {
        expect(germanUpperSsToSz("GROSSE STRASSE", "de")).toBe("GROßE STRAßE");
        expect(germanUpperSsToSz("WEISSE STRASSE", "de")).toBe("WEIßE STRAßE");
    });

    it("should preserve other characters", () => {
        expect(germanUpperSsToSz("GROßE STRASSE", "de")).toBe("GROßE STRAßE");
        expect(germanUpperSsToSz("GROSSE STRAßE", "de")).toBe("GROßE STRAßE");
    });
});
