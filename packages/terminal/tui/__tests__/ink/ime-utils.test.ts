import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IMECompositionBuffer, isIMEInput } from "../../src/ink/ime-utils";

describe(isIMEInput, () => {
    describe("returns false for ASCII input", () => {
        it("empty string", () => {
            expect.assertions(1);

            expect(isIMEInput("")).toBe(false);
        });

        it("single ASCII characters", () => {
            expect.assertions(4);

            expect(isIMEInput("a")).toBe(false);
            expect(isIMEInput("Z")).toBe(false);
            expect(isIMEInput("5")).toBe(false);
            expect(isIMEInput(" ")).toBe(false);
        });

        it("aSCII control characters", () => {
            expect.assertions(4);

            expect(isIMEInput("\r")).toBe(false);
            expect(isIMEInput("\n")).toBe(false);
            expect(isIMEInput("\t")).toBe(false);
            expect(isIMEInput("\u001B")).toBe(false);
        });

        it("multi-char ASCII strings", () => {
            expect.assertions(3);

            expect(isIMEInput("ab")).toBe(false);
            expect(isIMEInput("hello")).toBe(false);
            expect(isIMEInput("Hello World")).toBe(false);
        });
    });

    describe("returns false for Latin-1 Supplement (Option+key on macOS)", () => {
        it("accented Latin characters", () => {
            expect.assertions(5);

            expect(isIMEInput("\u00E0")).toBe(false); // à
            expect(isIMEInput("\u00E9")).toBe(false); // é
            expect(isIMEInput("\u00FC")).toBe(false); // ü
            expect(isIMEInput("\u00F1")).toBe(false); // ñ
            expect(isIMEInput("\u00DF")).toBe(false); // ß
        });
    });

    describe("returns true for CJK input", () => {
        it("chinese characters", () => {
            expect.assertions(2);

            expect(isIMEInput("\u4F60")).toBe(true); // 你
            expect(isIMEInput("\u4F60\u597D")).toBe(true); // 你好
        });

        it("japanese Hiragana", () => {
            expect.assertions(2);

            expect(isIMEInput("\u3042")).toBe(true); // あ
            expect(isIMEInput("\u3053\u3093\u306B\u3061\u306F")).toBe(true); // こんにちは
        });

        it("japanese Katakana", () => {
            expect.assertions(2);

            expect(isIMEInput("\u30A2")).toBe(true); // ア
            expect(isIMEInput("\u30AB\u30BF\u30AB\u30CA")).toBe(true); // カタカナ
        });

        it("cJK extension characters", () => {
            expect.assertions(2);

            expect(isIMEInput("\u3400")).toBe(true); // CJK Extension A
            expect(isIMEInput("\uF900")).toBe(true); // CJK Compatibility Ideographs
        });
    });

    describe("returns true for Korean input", () => {
        it("hangul syllables", () => {
            expect.assertions(3);

            expect(isIMEInput("\uAC00")).toBe(true); // 가
            expect(isIMEInput("\uC548\uB155")).toBe(true); // 안녕
            expect(isIMEInput("\uC548\uB155\uD558\uC138\uC694")).toBe(true); // 안녕하세요
        });

        it("hangul Jamo", () => {
            expect.assertions(2);

            expect(isIMEInput("\u1100")).toBe(true); // ᄀ
            expect(isIMEInput("\u3130")).toBe(true); // Hangul Compatibility Jamo
        });
    });

    describe("returns true for Vietnamese input", () => {
        it("vietnamese-specific precomposed characters (above U+00FF)", () => {
            expect.assertions(5);

            expect(isIMEInput("\u0103")).toBe(true); // ă
            expect(isIMEInput("\u0110")).toBe(true); // Đ
            expect(isIMEInput("\u01A1")).toBe(true); // ơ
            expect(isIMEInput("\u01B0")).toBe(true); // ư
            expect(isIMEInput("\u1EA3")).toBe(true); // ả
        });

        it("combining diacritical marks (above U+00FF)", () => {
            expect.assertions(3);

            expect(isIMEInput("\u0300")).toBe(true); // combining grave
            expect(isIMEInput("\u0301")).toBe(true); // combining acute
            expect(isIMEInput("\u0302")).toBe(true); // combining circumflex
        });
    });

    describe("returns true for other scripts", () => {
        it("thai characters", () => {
            expect.assertions(2);

            expect(isIMEInput("\u0E2A")).toBe(true); // ส
            expect(isIMEInput("\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35")).toBe(true); // สวัสดี
        });

        it("arabic characters", () => {
            expect.assertions(2);

            expect(isIMEInput("\u0645")).toBe(true); // م
            expect(isIMEInput("\u0645\u0631\u062D\u0628\u0627")).toBe(true); // مرحبا
        });

        it("devanagari characters", () => {
            expect.assertions(2);

            expect(isIMEInput("\u0928")).toBe(true); // न
            expect(isIMEInput("\u0928\u092E\u0938\u094D\u0924\u0947")).toBe(true); // नमस्ते
        });
    });
});

describe(IMECompositionBuffer, () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("buffers input and flushes after timeout", () => {
        expect.assertions(2);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60");
        buffer.add("\u597D");

        expect(onFlush).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);

        expect(onFlush).toHaveBeenCalledWith("\u4F60\u597D");

        buffer.destroy();
    });

    it("resets timer on each add", () => {
        expect.assertions(2);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60");

        vi.advanceTimersByTime(30);

        buffer.add("\u597D");

        vi.advanceTimersByTime(30);

        expect(onFlush).not.toHaveBeenCalled();

        vi.advanceTimersByTime(20);

        expect(onFlush).toHaveBeenCalledWith("\u4F60\u597D");

        buffer.destroy();
    });

    it("flushes immediately when flush() is called", () => {
        expect.assertions(1);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60");
        buffer.flush();

        expect(onFlush).toHaveBeenCalledWith("\u4F60");

        buffer.destroy();
    });

    it("does not call onFlush when buffer is empty", () => {
        expect.assertions(1);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.flush();

        expect(onFlush).not.toHaveBeenCalled();

        buffer.destroy();
    });

    it("cleans up timer on destroy", () => {
        expect.assertions(1);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60");
        buffer.destroy();

        vi.advanceTimersByTime(100);

        expect(onFlush).not.toHaveBeenCalled();
    });

    it("clears buffer content on destroy", () => {
        expect.assertions(1);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60");
        buffer.destroy();

        // Flush after destroy should be a no-op
        buffer.flush();

        expect(onFlush).not.toHaveBeenCalled();
    });

    it("handles multi-byte characters correctly", () => {
        expect.assertions(1);

        const onFlush = vi.fn();
        const buffer = new IMECompositionBuffer({ onFlush, timeout: 50 });

        buffer.add("\u4F60\u597D"); // 你好

        vi.advanceTimersByTime(50);

        expect(onFlush).toHaveBeenCalledWith("\u4F60\u597D");

        buffer.destroy();
    });
});
