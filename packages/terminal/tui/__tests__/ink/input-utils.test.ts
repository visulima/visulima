import { describe, expect, it } from "vitest";

import { isControlCharacter, isInsertableInput } from "../../src/ink/input-utils";

describe("input-utils", () => {
    describe(isControlCharacter, () => {
        it("should detect NUL", () => {
            expect.assertions(1);

            expect(isControlCharacter("\u0000")).toBe(true);
        });

        it("should detect ESC", () => {
            expect.assertions(1);

            expect(isControlCharacter("\u001B")).toBe(true);
        });

        it("should detect DEL (0x7F)", () => {
            expect.assertions(1);

            expect(isControlCharacter("\u007F")).toBe(true);
        });

        it("should detect BEL", () => {
            expect.assertions(1);

            expect(isControlCharacter("\u0007")).toBe(true);
        });

        it("should not detect printable ASCII", () => {
            expect.assertions(4);

            expect(isControlCharacter("a")).toBe(false);
            expect(isControlCharacter("Z")).toBe(false);
            expect(isControlCharacter("0")).toBe(false);
            expect(isControlCharacter(" ")).toBe(false); // space is 0x20, first printable
        });

        it("should not detect Unicode characters", () => {
            expect.assertions(2);

            expect(isControlCharacter("é")).toBe(false);
            expect(isControlCharacter("日")).toBe(false);
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            expect(isControlCharacter("")).toBe(false);
        });
    });

    describe(isInsertableInput, () => {
        it("should accept regular characters", () => {
            expect.assertions(3);

            expect(isInsertableInput("a", { ctrl: false, meta: false })).toBe(true);
            expect(isInsertableInput("Z", { ctrl: false, meta: false })).toBe(true);
            expect(isInsertableInput("5", { ctrl: false, meta: false })).toBe(true);
        });

        it("should reject empty input", () => {
            expect.assertions(1);

            expect(isInsertableInput("", { ctrl: false, meta: false })).toBe(false);
        });

        it("should reject control characters", () => {
            expect.assertions(2);

            expect(isInsertableInput("\u0001", { ctrl: false, meta: false })).toBe(false);
            expect(isInsertableInput("\u007F", { ctrl: false, meta: false })).toBe(false);
        });

        it("should reject Ctrl chords", () => {
            expect.assertions(2);

            expect(isInsertableInput("c", { ctrl: true, meta: false })).toBe(false);
            expect(isInsertableInput("s", { ctrl: true, meta: false })).toBe(false);
        });

        it("should reject Meta chords", () => {
            expect.assertions(1);

            expect(isInsertableInput("a", { ctrl: false, meta: true })).toBe(false);
        });

        it("should allow AltGr symbols (Ctrl+Meta together, non-letter)", () => {
            // AltGr on international keyboards sends Ctrl+Meta+symbol
            expect.assertions(2);

            expect(isInsertableInput("@", { ctrl: true, meta: true })).toBe(true);
            expect(isInsertableInput("€", { ctrl: true, meta: true })).toBe(true);
        });

        it("should reject AltGr with ASCII letters", () => {
            expect.assertions(2);

            expect(isInsertableInput("a", { ctrl: true, meta: true })).toBe(false);
            expect(isInsertableInput("Z", { ctrl: true, meta: true })).toBe(false);
        });

        it("should accept Unicode characters", () => {
            expect.assertions(2);

            expect(isInsertableInput("日", { ctrl: false, meta: false })).toBe(true);
            expect(isInsertableInput("😀", { ctrl: false, meta: false })).toBe(true);
        });

        it("should accept space", () => {
            expect.assertions(1);

            expect(isInsertableInput(" ", { ctrl: false, meta: false })).toBe(true);
        });
    });
});
