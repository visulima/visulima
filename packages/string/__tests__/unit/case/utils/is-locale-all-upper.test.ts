import { describe, expect, it } from "vitest";

import { isAllUpper, isAllUpperGerman, isAllUpperGreek, isAllUpperTurkish } from "../../../../src/case/utils/is-locale-all-upper";

describe("locale-specific isAllUpper helpers", () => {
    // German tests
    describe("german", () => {
        it('should consider "GROSSE" as all uppercase in de-DE', () => {
            expect(isAllUpperGerman("GROSSE", "de-DE")).toBeTruthy();
        });

        it('should consider "STRAßE" as all uppercase in de-DE', () => {
            // Although Unicode considers "ß" lowercase,
            // our helper for German treats it as acceptable.
            expect(isAllUpperGerman("STRAßE", "de-DE")).toBeTruthy();
        });

        it('should return false for "Strasse" in de-DE', () => {
            expect(isAllUpperGerman("Strasse", "de-DE")).toBeFalsy();
        });
    });

    // Greek tests
    describe("greek", () => {
        it('should consider "ΑΘΗΝΑ" as all uppercase in el-GR', () => {
            expect(isAllUpperGreek("ΑΘΗΝΑ", "el-GR")).toBeTruthy();
        });

        it('should consider "ΚΟΣΜΟΣ" as all uppercase in el-GR', () => {
            expect(isAllUpperGreek("ΚΟΣΜΟΣ", "el-GR")).toBeTruthy();
        });

        it('should consider a string with final sigma "ΚΟΣΜΟΣ" (with ς) as all uppercase in el-GR', () => {
            // Even if somehow a final sigma appears, our function will normalize it.
            // For example, if the string were "ΚΟΣΜός" in which "ός" is not typical,
            // we are simulating a scenario where a lowercase final sigma (ς) appears.
            const withFinalSigma = "ΚΟΣΜΟΣ".replace("Σ", "ς"); // artificially replace first Σ with ς
            expect(isAllUpperGreek(withFinalSigma, "el-GR")).toBeTruthy();
        });

        it('should return false for "Αθηνα" in el-GR', () => {
            expect(isAllUpperGreek("Αθηνα", "el-GR")).toBeFalsy();
        });
    });

    // Turkish tests
    describe("turkish", () => {
        it('should consider "İSTANBUL" as all uppercase in tr-TR', () => {
            expect(isAllUpperTurkish("İSTANBUL", "tr-TR")).toBeTruthy();
        });

        it('should return false for "Istanbul" in tr-TR', () => {
            expect(isAllUpperTurkish("Istanbul", "tr-TR")).toBeFalsy();
        });
    });

    // Generic helper tests using isAllUpper
    describe("generic isAllUpper", () => {
        it("should use the German logic when locale is de-DE", () => {
            expect(isAllUpper("STRAßE", "de-DE")).toBeTruthy();
            expect(isAllUpper("Strasse", "de-DE")).toBeFalsy();
        });

        it("should use the Greek logic when locale is el-GR", () => {
            expect(isAllUpper("ΑΘΗΝΑ", "el-GR")).toBeTruthy();
            expect(isAllUpper("Αθηνα", "el-GR")).toBeFalsy();
        });

        it("should use the Turkish logic when locale is tr-TR", () => {
            expect(isAllUpper("İSTANBUL", "tr-TR")).toBeTruthy();
            expect(isAllUpper("Istanbul", "tr-TR")).toBeFalsy();
        });

        it("should default to simple uppercase check when no locale is given", () => {
            expect(isAllUpper("FOO")).toBeTruthy();
            expect(isAllUpper("Foo")).toBeFalsy();
        });
    });
});
