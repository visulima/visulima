import { describe, expect, it } from "vitest";

import { durationLanguage as lt } from "../../../src/language/lt";
import { durationLanguage as pl } from "../../../src/language/pl";
import { durationLanguage as sl } from "../../../src/language/sl";
import type { DurationLanguage, DurationUnitName } from "../../../src/types";

const word = (language: DurationLanguage, unit: DurationUnitName, counter: number): string => {
    const value = language[unit];

    return typeof value === "function" ? value(counter) : value;
};

describe("slovenian plural forms", () => {
    it("should select the correct year form", () => {
        expect.assertions(5);

        expect(word(sl, "y", 1)).toBe("leto");
        expect(word(sl, "y", 102)).toBe("leti");
        expect(word(sl, "y", 3)).toBe("leta");
        expect(word(sl, "y", 2.5)).toBe("leta");
        expect(word(sl, "y", 5)).toBe("let");
    });

    it("should select the correct month form", () => {
        expect.assertions(4);

        expect(word(sl, "mo", 1)).toBe("mesec");
        expect(word(sl, "mo", 2.5)).toBe("meseca");
        expect(word(sl, "mo", 3)).toBe("mesece");
        expect(word(sl, "mo", 5)).toBe("mesecev");
    });

    it("should select the correct week form", () => {
        expect.assertions(5);

        expect(word(sl, "w", 1)).toBe("teden");
        expect(word(sl, "w", 3.5)).toBe("tedna");
        expect(word(sl, "w", 3)).toBe("tedne");
        expect(word(sl, "w", 4)).toBe("tedne");
        expect(word(sl, "w", 5)).toBe("tednov");
    });

    it("should select the correct minute form", () => {
        expect.assertions(4);

        expect(word(sl, "m", 1)).toBe("minuta");
        expect(word(sl, "m", 2)).toBe("minuti");
        expect(word(sl, "m", 2.5)).toBe("minute");
        expect(word(sl, "m", 5)).toBe("minut");
    });
});

describe("lithuanian plural forms", () => {
    it("should select the correct year form", () => {
        expect.assertions(3);

        expect(word(lt, "y", 10)).toBe("metų"); // counter % 10 === 0
        expect(word(lt, "y", 15)).toBe("metų"); // counter % 100 in 10..20
        expect(word(lt, "y", 1)).toBe("metai");
    });

    it("should select the correct month form across all three slavic forms", () => {
        expect.assertions(3);

        expect(word(lt, "mo", 21)).toBe("mėnuo"); // counter % 10 === 1 && counter % 100 > 20
        expect(word(lt, "mo", 2)).toBe("mėnesiai");
        expect(word(lt, "mo", 11)).toBe("mėnesių");
    });
});

describe("polish plural forms", () => {
    it("should select the correct year form across all four polish forms", () => {
        expect.assertions(4);

        expect(word(pl, "y", 1)).toBe("rok");
        expect(word(pl, "y", 1.5)).toBe("roku");
        expect(word(pl, "y", 2)).toBe("lata");
        expect(word(pl, "y", 12)).toBe("lat"); // counter % 100 between 11 and 19
    });
});
