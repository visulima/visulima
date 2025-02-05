import { describe, expect, it } from "vitest";

import type { TruncateOptions } from "../../../src/types";
import { truncateText } from "../../../src/utils/truncate-text";

describe("truncateText", () => {
    const defaultOptions: Required<TruncateOptions> = {
        position: "end",
        preferTruncationOnSpace: false,
        space: false,
        truncationCharacter: "…",
    };

    it("should return original text if within maxWidth", () => {
        expect.assertions(2);

        expect(truncateText("unicorn", 20, defaultOptions)).toBe("unicorn");
        expect(truncateText("unicorn", 7, defaultOptions)).toBe("unicorn");
    });

    it("should return empty string for maxWidth < 1", () => {
        expect.assertions(2);

        expect(truncateText("unicorn", 0, defaultOptions)).toBe("");
        expect(truncateText("unicorn", -4, defaultOptions)).toBe("");
    });

    it("should return truncation character for maxWidth = 1", () => {
        expect.assertions(1);

        expect(truncateText("unicorn", 1, defaultOptions)).toBe("…");
    });

    describe("end truncation", () => {
        it("should truncate at end", () => {
            expect.assertions(2);

            // maxWidth: 4
            // "uni" (3 width) + "…" (1 width) = 4 total width
            expect(truncateText("unicorn", 4, defaultOptions)).toBe("uni…");

            // maxWidth: 6
            // "unico" (5 width) + "…" (1 width) = 6 total width
            expect(truncateText("unicorn", 6, defaultOptions)).toBe("unico…");
        });

        it("should truncate at space when preferTruncationOnSpace is true", () => {
            expect.assertions(1);

            // maxWidth: 14
            // "Plant a tree" (11 width) + "…" (1 width) = 12 total width
            // Truncates at space before "every"
            expect(
                truncateText("Plant a tree every day.", 14, {
                    ...defaultOptions,
                    preferTruncationOnSpace: true,
                }),
            ).toBe("Plant a tree…");
        });

        it("should add space before truncation character when space is true", () => {
            expect.assertions(1);

            // maxWidth: 14
            // "Plant a tree" (11 width) + " " (1 width) + "…" (1 width) = 13 total width
            expect(
                truncateText("Plant a tree every day.", 14, {
                    ...defaultOptions,
                    space: true,
                }),
            ).toBe("Plant a tree …");
        });
    });

    describe("start truncation", () => {
        it("should truncate at start", () => {
            expect.assertions(2);

            // maxWidth: 5
            // "…" (1 width) + "corn" (4 width) = 5 total width
            expect(
                truncateText("unicorn", 5, {
                    ...defaultOptions,
                    position: "start",
                }),
            ).toBe("…corn");

            // maxWidth: 6
            // "…" (1 width) + "icorn" (5 width) = 6 total width
            expect(
                truncateText("unicorn", 6, {
                    ...defaultOptions,
                    position: "start",
                }),
            ).toBe("…icorn");
        });

        it("should truncate at space when preferTruncationOnSpace is true", () => {
            expect.assertions(1);

            // maxWidth: 15
            // "…" (1 width) + "are awesome" (11 width) = 12 total width
            // Truncates at space after "unicorns"
            expect(
                truncateText("unicorns are awesome", 15, {
                    ...defaultOptions,
                    position: "start",
                    preferTruncationOnSpace: true,
                }),
            ).toBe("…are awesome");
        });

        it("should add space after truncation character when space is true", () => {
            expect.assertions(1);

            // maxWidth: 6
            // "…" (1 width) + " " (1 width) + "orns" (4 width) = 6 total width
            expect(
                truncateText("unicorns", 6, {
                    ...defaultOptions,
                    position: "start",
                    space: true,
                }),
            ).toBe("… orns");
        });
    });

    describe("middle truncation", () => {
        it("should truncate in the middle", () => {
            expect.assertions(2);

            // maxWidth: 5
            // "un" (2 width) + "…" (1 width) + "rn" (2 width) = 5 total width
            expect(
                truncateText("unicorn", 5, {
                    ...defaultOptions,
                    position: "middle",
                }),
            ).toBe("un…rn");

            // maxWidth: 6
            // "uni" (3 width) + "…" (1 width) + "ns" (2 width) = 6 total width
            expect(
                truncateText("unicorns", 6, {
                    ...defaultOptions,
                    position: "middle",
                }),
            ).toBe("uni…ns");
        });

        it("should truncate at spaces when preferTruncationOnSpace is true", () => {
            expect.assertions(1);

            // maxWidth: 20
            // "unicorns" (8 width) + "…" (1 width) + "dragons" (7 width) = 16 total width
            // Truncates at spaces around "partying with"
            expect(
                truncateText("unicorns partying with dragons", 20, {
                    ...defaultOptions,
                    position: "middle",
                    preferTruncationOnSpace: true,
                }),
            ).toBe("unicorns…dragons");
        });

        it("should add spaces around truncation character when space is true", () => {
            expect.assertions(1);

            // maxWidth: 7
            // "un" (2 width) + " " (1 width) + "…" (1 width) + " " (1 width) + "rns" (3 width) = 8 total width
            expect(
                truncateText("unicorns", 7, {
                    ...defaultOptions,
                    position: "middle",
                    space: true,
                }),
            ).toBe("un … rns");
        });
    });

    it("should handle text with ANSI codes", () => {
        expect.assertions(4);

        // ANSI codes don't contribute to width
        expect(truncateText("\u001B[31municorn\u001B[39m", 7, defaultOptions)).toBe("\u001B[31municorn\u001B[39m");
        expect(truncateText("\u001B[31municorn\u001B[39m", 1, defaultOptions)).toBe("…");
        expect(truncateText("\u001B[31municorn\u001B[39m", 4, defaultOptions)).toBe("\u001B[31muni\u001B[39m…");
        // Test split ANSI codes - should preserve the first color code and close it
        expect(truncateText("\u001B[31muni\u001B[32mcorn\u001B[39m", 4, defaultOptions)).toBe("\u001B[31muni\u001B[39m…");
    });

    it("should handle text with wide characters", () => {
        expect.assertions(3);

        // Each Korean character takes 2 width units
        // 안 (2) + … (1) = 3
        // maxWidth: 3
        // "안" (2 width) + "…" (1 width) = 3 total width
        expect(truncateText("안녕하세요", 3, defaultOptions)).toBe("안…");

        // maxWidth: 5
        // "안녕" (4 width) + "…" (1 width) = 5 total width
        expect(truncateText("안녕하세요", 5, defaultOptions)).toBe("안녕…");

        // maxWidth: 3
        // "안" (2 width) + "…" (1 width) = 3 total width
        // ANSI codes don't contribute to width
        expect(truncateText("\u001B[31m안녕\u001B[39m", 3, defaultOptions)).toBe("\u001B[31m안\u001B[39m…");
    });

    it("should handle text with surrogate pairs", () => {
        expect.assertions(2);

        // Each surrogate pair (🈀) counts as 2 width units
        // maxWidth: 4
        // "a" (1 width) + "🈀" (2 width) + "…" (1 width) = 4 total width
        expect(truncateText("a\uD83C\uDE00b\uD83C\uDE00c", 4, defaultOptions)).toBe("a\uD83C\uDE00…");

        // maxWidth: 5
        // "a" (1 width) + "🈀" (2 width) + "b" (1 width) + "…" (1 width) = 5 total width
        expect(truncateText("a\uD83C\uDE00b\uD83C\uDE00c", 5, defaultOptions)).toBe("a\uD83C\uDE00b…");
    });

    describe("space option", () => {
        it("should handle spaces correctly with different positions", () => {
            expect.assertions(3);

            // maxWidth: 6
            // "uni" (3 width) + " " (1 width) + "…" (1 width) = 5 total width
            expect(
                truncateText("unicorns", 5, {
                    ...defaultOptions,
                    position: "end",
                    space: true,
                }),
            ).toBe("uni …");

            // maxWidth: 7
            // "…" (1) + " " (1) + "orns" (4) = 6 total width
            expect(
                truncateText("unicorns", 6, {
                    ...defaultOptions,
                    position: "start",
                    space: true,
                }),
            ).toBe("… orns");

            // maxWidth: 8
            // "un" (2) + " " (1) + "…" (1) + " " (1) + "rns" (3) = 8 total width
            expect(
                truncateText("unicorns", 8, {
                    ...defaultOptions,
                    position: "middle",
                    space: true,
                }),
            ).toBe("un … rns");
        });

        it("should handle ANSI codes with spaces", () => {
            expect.assertions(1);

            const text = "\u001B[31municorn\u001B[39m";
            // maxWidth: 7
            // "unic" (4 width) + " " (1 width) + "…" (1 width) = 6 total width
            // ANSI codes don't contribute to width
            expect(
                truncateText(text, 7, {
                    ...defaultOptions,
                    space: true,
                }),
            ).toBe("\u001B[31munic\u001B[39m …");
        });

        it("should handle wide characters with spaces", () => {
            expect.assertions(1);

            // maxWidth: 4
            // "안" (2 width) + " " (1 width) + "…" (1 width) = 4 total width
            expect(
                truncateText("안녕하세요", 4, {
                    ...defaultOptions,
                    space: true,
                }),
            ).toBe("안 …");
        });
    });

    describe("truncationCharacter option", () => {
        it("should use custom truncation character", () => {
            expect.assertions(3);

            expect(
                truncateText("unicorns", 5, {
                    ...defaultOptions,
                    truncationCharacter: ".",
                }),
            ).toBe("unic.");

            expect(
                truncateText("unicorns", 5, {
                    ...defaultOptions,
                    position: "start",
                    truncationCharacter: ".",
                }),
            ).toBe(".orns");

            expect(
                truncateText("unicorns", 5, {
                    ...defaultOptions,
                    position: "middle",
                    truncationCharacter: ".",
                }),
            ).toBe("un.ns");
        });

        it("should handle custom truncation character with spaces", () => {
            expect.assertions(1);

            // maxWidth: 6
            // "uni" (3 width) + " " (1 width) + "." (1 width) = 5 total width
            expect(
                truncateText("unicorns", 6, {
                    ...defaultOptions,
                    truncationCharacter: ".",
                    space: true,
                }),
            ).toBe("uni .");
        });

        it("should handle custom truncation character with ANSI codes", () => {
            expect.assertions(1);

            const text = "\u001B[31municornsareawesome\u001B[39m";
            // maxWidth: 15
            // "unico" (5 width) + " " (1 width) + "." (1 width) + " " (1 width) + "some" (4 width) = 12 total width
            // ANSI codes don't contribute to width
            expect(
                truncateText(text, 15, {
                    ...defaultOptions,
                    position: "middle",
                    space: true,
                    truncationCharacter: ".",
                }),
            ).toBe("\u001B[31munico\u001B[39m . \u001B[31msome\u001B[39m");
        });
    });
});
