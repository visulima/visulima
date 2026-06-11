import { describe, expect, it } from "vitest";

import humanizer from "../../src/humanizer";
import { durationLanguage as deDurationLanguage } from "../../src/language/de";

describe(humanizer, () => {
    it("should create an instance that applies the configured options to duration()", () => {
        expect.assertions(1);

        const instance = humanizer({ language: deDurationLanguage, units: ["h", "m"] });

        expect(instance.duration(3_600_000 + 30 * 60_000)).toBe("1 Stunde, 30 Minuten");
    });

    it("should apply the configured language to parseDuration()", () => {
        expect.assertions(1);

        const instance = humanizer({ language: deDurationLanguage });

        expect(instance.parseDuration("2,5 Stunden")).toBe(2.5 * 3_600_000);
    });

    it("should let per-call overrides win over instance defaults", () => {
        expect.assertions(1);

        const instance = humanizer({ language: deDurationLanguage, units: ["h", "m"] });

        expect(instance.duration(90_000, { units: ["s"] })).toBe("90 Sekunden");
    });

    it("should work without any preconfigured options", () => {
        expect.assertions(2);

        const instance = humanizer();

        expect(instance.duration(60_000)).toBe("1 minute");
        expect(instance.parseDuration("1h")).toBe(3_600_000);
    });
});
