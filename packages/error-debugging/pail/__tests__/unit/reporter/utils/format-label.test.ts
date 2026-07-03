import { describe, expect, it } from "vitest";

import type { PrettyStyleOptions } from "../../../../src/reporter/pretty/abstract-pretty-reporter";
import formatLabel from "../../../../src/reporter/utils/format-label";

const buildStyles = (bold: boolean, underline: boolean, uppercase: boolean): PrettyStyleOptions =>
    ({
        bold: { label: bold },
        underline: { label: underline },
        uppercase: { label: uppercase },
    }) as unknown as PrettyStyleOptions;

describe(formatLabel, () => {
    it("should uppercase the label when configured", () => {
        expect.assertions(1);

        expect(formatLabel("info", buildStyles(false, false, true))).toContain("INFO");
    });

    it("should leave the label untouched when no styles are enabled", () => {
        expect.assertions(1);

        expect(formatLabel("info", buildStyles(false, false, false))).toBe("info");
    });

    it("should apply bold and underline styling to the label", () => {
        expect.assertions(1);

        expect(formatLabel("info", buildStyles(true, true, true))).toContain("INFO");
    });
});
