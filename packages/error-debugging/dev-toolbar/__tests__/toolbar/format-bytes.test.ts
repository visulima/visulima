import { describe, expect, it } from "vitest";

import { formatBytes } from "../../src/toolbar/utils";

describe(formatBytes, () => {
    it("reports whole bytes below a kibibyte", () => {
        expect.hasAssertions();

        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(1023)).toBe("1023 B");
    });

    it("switches to KB at exactly one kibibyte", () => {
        expect.hasAssertions();

        expect(formatBytes(1024)).toBe("1.0 KB");
    });

    it("switches to MB at exactly one mebibyte", () => {
        expect.hasAssertions();

        expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
        expect(formatBytes(1024 * 1024 - 1)).toBe("1024.0 KB");
    });

    it("keeps one decimal place", () => {
        expect.hasAssertions();

        expect(formatBytes(1536)).toBe("1.5 KB");
        expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("renders an unstattable size as a dash rather than NaN", () => {
        expect.hasAssertions();

        expect(formatBytes(Number.NaN)).toBe("–");
        expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("–");
        expect(formatBytes(-1)).toBe("–");
    });
});
