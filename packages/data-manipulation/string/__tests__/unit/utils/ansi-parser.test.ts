import { describe, expect, it } from "vitest";

import { checkEscapeSequence, processAnsiString } from "../../../src/utils/ansi-parser";
import type { AnsiSegment, HyperlinkSegment } from "../../../src/utils/types";

describe(checkEscapeSequence, () => {
    it("should detect regular ANSI escape sequences", () => {
        expect.assertions(1);

        const text = "\u001B[31mHello";
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: splitting string into char array for ANSI parsing
        const chars = [...text];

        const result = checkEscapeSequence(chars, 0);

        expect(result).toStrictEqual({
            isInsideEscape: true,
            isInsideLinkEscape: false,
        });
    });

    it("should detect hyperlink start sequences", () => {
        expect.assertions(1);

        const text = "\u001B]8;;https://example.com\u0007Hello";
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: splitting string into char array for ANSI parsing
        const chars = [...text];

        const result = checkEscapeSequence(chars, 0);

        expect(result).toStrictEqual({
            isInsideEscape: true,
            isInsideLinkEscape: true,
        });
    });

    it("should return false for non-escape sequences", () => {
        expect.assertions(1);

        const text = "Hello World";
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: splitting string into char array for ANSI parsing
        const chars = [...text];

        const result = checkEscapeSequence(chars, 0);

        expect(result).toStrictEqual({
            isInsideEscape: false,
            isInsideLinkEscape: false,
        });
    });
});

describe(processAnsiString, () => {
    describe("regular ANSI sequences", () => {
        it("should process basic ANSI color codes", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B[31mHello\u001B[0m";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(7);
            expect(segments).toMatchSnapshot();
        });

        it("should handle nested ANSI sequences", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B[31m\u001B[1mBold Red\u001B[0m";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(11);
            expect(segments).toMatchSnapshot();
        });
    });

    describe("hyperlink handling", () => {
        it("should process hyperlink sequences", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example.com\u0007Click here\u001B\\";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(12);
            expect(segments).toMatchSnapshot();
        });

        it("should handle nested ANSI sequences within hyperlinks", () => {
            expect.assertions(3);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example.com\u0007\u001B[31mRed Link\u001B[0m\u001B\\";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(12);
            expect(segments.map((s) => s.text ?? "").join("")).toBe("\u001B[31mRed Link\u001B[0m");
            expect(segments).toMatchSnapshot();
        });

        it("should handle multiple hyperlinks", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example1.com\u0007Link 1\u001B\\ and \u001B]8;;https://example2.com\u0007Link 2\u001B\\";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(21);
            expect(segments).toMatchSnapshot();
        });
    });

    describe("grapheme handling", () => {
        it("should handle combining characters", () => {
            expect.assertions(3);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "e\u0301"; // é using combining acute accent

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(2);
            expect(segments[0]).toMatchObject({
                isGrapheme: true,
                text: "e",
            });
            expect(segments[1]).toMatchObject({
                isGrapheme: true,
                text: "\u0301",
            });
        });

        it("should handle emoji sequences", () => {
            expect.assertions(8);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "👨‍👩‍👧‍👦"; // family emoji

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            // Each ZWJ-connected emoji component should be a separate segment
            expect(segments.length).toBeGreaterThan(1);

            segments.forEach((segment) => {
                expect(segment.isGrapheme).toBe(true);
            });
        });
    });

    describe("error handling", () => {
        it("should handle incomplete ANSI sequences", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B[31"; // Incomplete color code

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(1);
            expect(segments[0]).toMatchObject({
                isEscapeSequence: true,
                text: "\u001B[31",
            });
        });

        it("should handle incomplete hyperlink sequences", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example.com"; // Missing BEL

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(1);
            expect(segments[0]).toMatchObject({
                hyperlinkUrl: "https://example.com",
                isEscapeSequence: true,
            });
        });
    });

    describe("callback control", () => {
        it("should stop processing when callback returns false", () => {
            expect.assertions(1);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B[31mHello\u001B[0m World";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return segments.length < 2; // Stop after 2 segments
                },
            });

            expect(segments).toHaveLength(2);
        });

        it("should handle missing width function", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "Hello";

            processAnsiString(text, {
                onSegment: (segment) => {
                    segments.push(segment);

                    return true;
                },
            });

            expect(segments).toHaveLength(5);
            expect(segments[0].width).toBe(0);
        });

        it("should stop processing when the callback returns false on an SGR escape segment", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B[31mHello\u001B[0m";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    // Stop as soon as the opening color escape is emitted.
                    return false;
                },
            });

            expect(segments).toHaveLength(1);
            expect(segments[0]).toMatchObject({
                isEscapeSequence: true,
                text: "\u001B[31m",
            });
        });

        it("should stop processing when the callback returns false on a hyperlink-start segment", () => {
            expect.assertions(2);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example.com\u0007Click\u001B\\";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    return false;
                },
            });

            expect(segments).toHaveLength(1);
            expect(segments[0]).toMatchObject({
                hyperlinkUrl: "https://example.com",
                isHyperlinkStart: true,
            });
        });

        it("should stop processing when the callback returns false on a hyperlink-end segment", () => {
            expect.assertions(1);

            const segments: (AnsiSegment | HyperlinkSegment)[] = [];
            const text = "\u001B]8;;https://example.com\u0007X\u001B\\";

            processAnsiString(text, {
                getWidth: (string_) => string_.length,
                onSegment: (segment) => {
                    segments.push(segment);

                    // Allow everything except the hyperlink-end segment, then stop on it.
                    return !(segment as HyperlinkSegment).isHyperlinkEnd;
                },
            });

            expect(segments.at(-1)).toMatchObject({
                isHyperlinkEnd: true,
            });
        });
    });
});
