import { describe, expect, it } from "vitest";

import type { SerpData, SerpOverflow } from "../../../src/apps/seo/analyze";
import { COMMON_CHECKS, getSerpIssues, truncateToChars } from "../../../src/apps/seo/analyze";

const data: SerpData = {
    description: "A description",
    favicon: "https://example.com/favicon.ico",
    siteName: "example.com",
    title: "A title",
    url: "https://example.com/page",
};

const noOverflow: SerpOverflow = { descriptionOverflow: false, descriptionOverflowMobile: false, titleOverflow: false };

describe(truncateToChars, () => {
    it("leaves text at the limit untouched", () => {
        expect.hasAssertions();

        expect(truncateToChars("abcde", 5)).toBe("abcde");
    });

    it("keeps the result within the limit, ellipsis included", () => {
        expect.hasAssertions();

        const result = truncateToChars("abcdefghij", 6);

        expect(result).toBe("abc...");
        expect(result).toHaveLength(6);
    });

    it("returns just an ellipsis when the limit cannot fit any text", () => {
        expect.hasAssertions();

        expect(truncateToChars("abcdefghij", 3)).toBe("...");
    });
});

describe(getSerpIssues, () => {
    it("reports nothing for a complete snippet", () => {
        expect.hasAssertions();

        expect(getSerpIssues(data, noOverflow, COMMON_CHECKS)).toStrictEqual([]);
    });

    it("flags a missing favicon", () => {
        expect.hasAssertions();

        expect(getSerpIssues({ ...data, favicon: null }, noOverflow, COMMON_CHECKS)).toStrictEqual(["No favicon or icon set on the page."]);
    });

    it("treats a whitespace-only title as missing", () => {
        expect.hasAssertions();

        expect(getSerpIssues({ ...data, title: "   " }, noOverflow, COMMON_CHECKS)).toStrictEqual(["No title tag set on the page."]);
    });

    it("flags an overflowing title", () => {
        expect.hasAssertions();

        expect(getSerpIssues(data, { ...noOverflow, titleOverflow: true }, COMMON_CHECKS)).toStrictEqual([
            "The title exceeds ~60 characters and may be truncated in search results.",
        ]);
    });
});
