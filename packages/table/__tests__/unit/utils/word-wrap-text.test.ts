import { describe, expect, it } from "vitest";

import { wordWrapText } from "../../../src/utils/word-wrap-text";

describe("wordWrapText", () => {
    it("should return original text if within maxWidth", () => {
        expect.assertions(1);

        expect(wordWrapText("Hello", 5)).toEqual(["Hello"]);
    });

    it("should return original text if maxWidth <= 0", () => {
        expect.assertions(2);

        expect(wordWrapText("Hello", 0)).toEqual(["Hello"]);
        expect(wordWrapText("Hello", -1)).toEqual(["Hello"]);
    });

    it("should wrap text at word boundaries", () => {
        expect.assertions(1);

        expect(wordWrapText("Hello World", 5)).toEqual(["Hello", "World"]);
    });

    it("should handle text with ANSI codes", () => {
        expect.assertions(1);

        const text = "\u001B[31mHello\u001B[0m \u001B[32mWorld\u001B[0m";
        expect(wordWrapText(text, 5)).toEqual(["\u001B[31mHello\u001B[0m", "\u001B[32mWorld\u001B[0m"]);
    });

    it("should handle text with hyperlinks", () => {
        expect.assertions(1);

        const text = "Click \u001B]8;;http://example.com\u0007here\u001B]8;;\u0007 now";
        expect(wordWrapText(text, 7)).toEqual(["Click", "\u001B]8;;http://example.com\u0007here\u001B]8;;\u0007", "now"]);
    });

    it("should handle text with wide characters", () => {
        expect.assertions(1);

        expect(wordWrapText("Hello 世界", 7)).toEqual(["Hello", "世界"]);
    });

    it("should handle long words by breaking them", () => {
        expect.assertions(1);

        expect(wordWrapText("Supercalifragilisticexpialidocious", 10)).toEqual(["Supercalif", "ragilistic", "expialidoc", "ious"]);
    });

    it("should preserve newlines in text", () => {
        expect.assertions(1);

        expect(wordWrapText("Hello\nWorld\nTest", 10)).toEqual(["Hello", "World", "Test"]);
    });

    it("should handle multiple spaces", () => {
        expect.assertions(1);

        expect(wordWrapText("Hello    World", 7)).toEqual(["Hello", "World"]);
    });

    it("should handle text with mixed ANSI codes and wide characters", () => {
        expect.assertions(1);

        const text = "\u001B[31m你好\u001B[0m \u001B[32m世界\u001B[0m";
        expect(wordWrapText(text, 4)).toEqual(["\u001B[31m你好\u001B[0m", "\u001B[32m世界\u001B[0m"]);
    });

    it("should handle empty text", () => {
        expect.assertions(1);

        expect(wordWrapText("", 10)).toEqual([""]);
    });

    it("should preserve ANSI formatting across wrapped lines", () => {
        expect.assertions(2);

        const text = "\u001B[1m\u001B[31mThis is a long bold red text that should wrap\u001B[0m";
        const wrapped = wordWrapText(text, 10);

        expect(wrapped.every((line) => line.includes("\u001B[1m") && line.includes("\u001B[31m"))).toBeTruthy();
        expect(wrapped.every((line) => line.endsWith("\u001B[0m"))).toBeTruthy();
    });
});
