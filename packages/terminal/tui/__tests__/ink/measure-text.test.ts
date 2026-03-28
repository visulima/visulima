import { describe, expect, it } from "vitest";

import measureText from "../../src/ink/measure-text";

describe("measure-text", () => {
    it("measure single word", () => {
        expect.assertions(1);

        expect(measureText("constructor")).toStrictEqual({ height: 1, width: 11 });
    });

    it("measure empty string", () => {
        expect.assertions(1);

        expect(measureText("")).toStrictEqual({ height: 0, width: 0 });
    });

    it("measure multiline text", () => {
        expect.assertions(2);

        const result = measureText("hello\nworld");

        expect(result.width).toBe(5);
        expect(result.height).toBe(2);
    });

    it("measure multiline text with varying line lengths", () => {
        expect.assertions(2);

        const result = measureText("a\nfoo\nhi");

        expect(result.width).toBe(3);
        expect(result.height).toBe(3);
    });

    it("measure text with trailing newline", () => {
        expect.assertions(2);

        const result = measureText("hello\n");

        expect(result.width).toBe(5);
        expect(result.height).toBe(2);
    });

    it("measure text with only newlines", () => {
        expect.assertions(2);

        const result = measureText("\n\n");

        expect(result.width).toBe(0);
        expect(result.height).toBe(3);
    });

    it("returns cached result on repeated calls", () => {
        expect.assertions(3);

        const first = measureText("cached-test");

        expect(first.width).toBe(11);
        expect(first.height).toBe(1);

        const second = measureText("cached-test");

        expect(first).toBe(second);
    });

    it("measure text with ANSI escape sequences", () => {
        expect.assertions(2);

        const result = measureText("\u001B[31mred\u001B[0m");

        expect(result.width).toBe(3);
        expect(result.height).toBe(1);
    });

    it("measure text with 256-color ANSI", () => {
        expect.assertions(2);

        const result = measureText("\u001B[38;5;196mred\u001B[0m");

        expect(result.width).toBe(3);
        expect(result.height).toBe(1);
    });

    it("measure text with wide characters", () => {
        expect.assertions(2);

        const result = measureText("你好");

        expect(result.width).toBe(4);
        expect(result.height).toBe(1);
    });

    it("measure text with emoji", () => {
        expect.assertions(2);

        const result = measureText("🍔");

        expect(result.width).toBe(2);
        expect(result.height).toBe(1);
    });

    it("measure multiline with wide characters", () => {
        expect.assertions(2);

        const result = measureText("🍔🍟\nabc");

        expect(result.width).toBe(4);
        expect(result.height).toBe(2);
    });
});
