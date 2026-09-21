import { describe, expect, it } from "vitest";

import { extractTokens, parseToPx } from "../../../src/apps/tailwind/analyze";

const variables = (entries: [string, string][]): Map<string, string> => new Map(entries);

describe(parseToPx, () => {
    it("converts rem against a 16px root", () => {
        expect.hasAssertions();

        expect(parseToPx("1.5rem")).toBe(24);
    });

    it("takes px at face value", () => {
        expect.hasAssertions();

        expect(parseToPx("12px")).toBe(12);
    });

    it("treats em like rem", () => {
        expect.hasAssertions();

        expect(parseToPx("2em")).toBe(32);
    });

    it("returns zero for a unit it cannot read", () => {
        expect.hasAssertions();

        expect(parseToPx("4vh")).toBe(0);
        expect(parseToPx("clamp(1rem, 2vw, 3rem)")).toBe(0);
    });
});

describe(extractTokens, () => {
    it("routes each prefix to its own bucket", () => {
        expect.hasAssertions();

        const tokens = extractTokens(
            variables([
                ["--color-red-500", "#ef4444"],
                ["--spacing-4", "1rem"],
                ["--text-lg", "1.125rem"],
                ["--font-sans", "ui-sans-serif"],
                ["--radius-md", "0.375rem"],
                ["--shadow-lg", "0 10px 15px rgb(0 0 0 / 0.1)"],
            ]),
        );

        expect({
            colors: tokens.colors.map((token) => token.name),
            fontFamilies: tokens.fontFamilies.map((token) => token.name),
            fontSizes: tokens.fontSizes.map((token) => token.name),
            radii: tokens.radii.map((token) => token.name),
            shadows: tokens.shadows.map((token) => token.name),
            spacing: tokens.spacing.map((token) => token.name),
        }).toStrictEqual({
            colors: ["red-500"],
            fontFamilies: ["sans"],
            fontSizes: ["lg"],
            radii: ["md"],
            // Shadows keep their prefix so `--drop-shadow-*` stays distinguishable.
            shadows: ["shadow-lg"],
            spacing: ["4"],
        });
    });

    it("keeps drop shadows apart from box shadows by name", () => {
        expect.hasAssertions();

        const tokens = extractTokens(variables([["--drop-shadow-xl", "drop-shadow(0 9px 7px rgb(0 0 0 / 0.1))"]]));

        expect(tokens.shadows.map((token) => token.name)).toStrictEqual(["drop-shadow-xl"]);
    });

    it("excludes the line-height and font-weight companions of a text size", () => {
        expect.hasAssertions();

        const tokens = extractTokens(
            variables([
                ["--text-lg", "1.125rem"],
                ["--text-lg--line-height", "1.75rem"],
                ["--text-lg--font-weight", "600"],
            ]),
        );

        expect(tokens.fontSizes.map((token) => token.name)).toStrictEqual(["lg"]);
    });

    it("sorts spacing by computed pixels, not by declaration order", () => {
        expect.hasAssertions();

        const tokens = extractTokens(
            variables([
                ["--spacing-8", "2rem"],
                ["--spacing-1", "4px"],
                ["--spacing-4", "1rem"],
            ]),
        );

        expect(tokens.spacing.map((token) => token.name)).toStrictEqual(["1", "4", "8"]);
    });

    it("sorts font sizes by computed pixels across mixed units", () => {
        expect.hasAssertions();

        const tokens = extractTokens(
            variables([
                ["--text-xl", "1.25rem"],
                ["--text-xs", "12px"],
                ["--text-base", "1rem"],
            ]),
        );

        expect(tokens.fontSizes.map((token) => token.name)).toStrictEqual(["xs", "base", "xl"]);
    });

    it("ignores a variable that matches no known prefix", () => {
        expect.hasAssertions();

        const tokens = extractTokens(variables([["--leading-tight", "1.25"]]));

        expect(Object.values(tokens).every((bucket) => bucket.length === 0)).toBe(true);
    });
});
