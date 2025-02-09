import { describe, expect, it } from "vitest";

import { normalizeGermanEszett } from "../../../../src/case/utils/normalize-german-eszett";
import { normalizeGreekSigma } from "../../../../src/case/utils/normalize-greek-sigma";

describe("normalize-case", () => {
    describe("normalizeGermanEszett", () => {
        it("should convert uppercase SS to ß in German text", () => {
            expect(normalizeGermanEszett("STRASSE", "de")).toBe("STRAßE");
            expect(normalizeGermanEszett("GROSSE", "de-DE")).toBe("GROßE");
            expect(normalizeGermanEszett("WEISS", "de-AT")).toBe("WEIß");
        });

        it("should not convert SS in non-German text", () => {
            expect(normalizeGermanEszett("STRASSE", "en")).toBe("STRASSE");
            expect(normalizeGermanEszett("GROSSE", "fr")).toBe("GROSSE");
            expect(normalizeGermanEszett("WEISS", "tr")).toBe("WEISS");
        });

        it("should not convert lowercase or mixed case ss", () => {
            expect(normalizeGermanEszett("strasse", "de")).toBe("strasse");
            expect(normalizeGermanEszett("Strasse", "de")).toBe("Strasse");
            expect(normalizeGermanEszett("straSSe", "de")).toBe("straSSe");
        });

        it("should handle empty or undefined locale", () => {
            expect(normalizeGermanEszett("STRASSE")).toBe("STRASSE");
        });

        it("should handle multiple SS occurrences", () => {
            expect(normalizeGermanEszett("GROSSE STRASSE", "de")).toBe("GROßE STRAßE");
            expect(normalizeGermanEszett("WEISSE STRASSE", "de")).toBe("WEIßE STRAßE");
        });

        it("should preserve other characters", () => {
            expect(normalizeGermanEszett("GROßE STRASSE", "de")).toBe("GROßE STRAßE");
            expect(normalizeGermanEszett("GROSSE STRAßE", "de")).toBe("GROßE STRAßE");
        });
    });

    describe("normalizeGreekSigma", () => {
        it("should convert σ to ς at word end in Greek locale", () => {
            expect(normalizeGreekSigma("καλημέρας", "el-GR")).toBe("καλημέραΣ");
            expect(normalizeGreekSigma("σοφός", "el-GR")).toBe("ΣοφόΣ");
            expect(normalizeGreekSigma("Οδυσσέας", "el-GR")).toBe("ΟδυΣΣέαΣ");
        });

        it("should not convert σ to ς in the middle of words", () => {
            expect(normalizeGreekSigma("μέσος", "el-GR")).toBe("μέΣοΣ");
            expect(normalizeGreekSigma("κόσμος", "el-GR")).toBe("κόΣμοΣ");
            expect(normalizeGreekSigma("Περσέας", "el-GR")).toBe("ΠερΣέαΣ");
        });

        it("should not convert when not in Greek locale", () => {
            expect(normalizeGreekSigma("σοφός", "en-US")).toBe("σοφός");
            expect(normalizeGreekSigma("μέσος", "fr-FR")).toBe("μέσος");
            expect(normalizeGreekSigma("Οδυσσέας")).toBe("Οδυσσέας");
        });

        it("should handle uppercase sigma correctly", () => {
            expect(normalizeGreekSigma("ΣΟΦΟΣ", "el-GR")).toBe("ΣΟΦΟΣ");
            expect(normalizeGreekSigma("ΜΕΣΟΣ", "el-GR")).toBe("ΜΕΣΟΣ");
            expect(normalizeGreekSigma("ΠΕΡΣΕΑΣ", "el-GR")).toBe("ΠΕΡΣΕΑΣ");
        });

        it("should handle mixed case correctly", () => {
            expect(normalizeGreekSigma("Σοφός", "el-GR")).toBe("ΣοφόΣ");
            expect(normalizeGreekSigma("ΜέΣος", "el-GR")).toBe("ΜέΣοΣ");
            expect(normalizeGreekSigma("ΠερΣέας", "el-GR")).toBe("ΠερΣέαΣ");
        });
    });
});
