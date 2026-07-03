import { describe, expect, it } from "vitest";

import type { InputEvent } from "../../src/ink/input-parser";
import { createInputParser } from "../../src/ink/input-parser";

const parseChunks = (chunks: string[]): InputEvent[] => {
    const parser = createInputParser();
    const events: InputEvent[] = [];

    chunks.forEach((chunk) => {
        events.push(...parser.push(chunk));
    });

    return events;
};

describe("input-parser", () => {
    it("passes through plain text chunks", () => {
        expect.assertions(1);

        expect(parseChunks(["hello", " ", "world"])).toStrictEqual(["hello", " ", "world"]);
    });

    it("keeps plain text and control sequences separate", () => {
        expect.assertions(1);

        expect(parseChunks(["a\u001B[Ab"])).toStrictEqual(["a", "\u001B[A", "b"]);
    });

    it("parses multiple standard CSI keys in one chunk", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[A\u001B[B\u001B[C\u001B[D"])).toStrictEqual(["\u001B[A", "\u001B[B", "\u001B[C", "\u001B[D"]);
    });

    it("parses CSI sequences with parameters", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[1;5A\u001B[5~\u001B[6~"])).toStrictEqual(["\u001B[1;5A", "\u001B[5~", "\u001B[6~"]);
    });

    it("parses kitty protocol sequence as one key event", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[97;5u"])).toStrictEqual(["\u001B[97;5u"]);
    });

    it("parses SS3 sequences as one key event", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001BOA\u001BOB\u001BOC\u001BOD"])).toStrictEqual(["\u001BOA", "\u001BOB", "\u001BOC", "\u001BOD"]);
    });

    it("does not consume a following escape as SS3 final byte", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001BO\u001B[A"])).toStrictEqual(["\u001BO", "\u001B[A"]);
    });

    it("parses meta+CSI sequence with double escape", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B\u001B[A"])).toStrictEqual(["\u001B\u001B[A"]);
    });

    it("parses escaped printable code points", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001Bx\u001B1"])).toStrictEqual(["\u001Bx", "\u001B1"]);
    });

    it("parses escaped supplementary code points", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B😀"])).toStrictEqual(["\u001B😀"]);
    });

    it("preserves legacy ESC[[... sequences in a mixed chunk", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[[A\u001B[[5~"])).toStrictEqual(["\u001B[[A", "\u001B[[5~"]);
    });

    it("preserves legacy ESC[[... sequences across chunks", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[[", "A\u001B[[5~"])).toStrictEqual(["\u001B[[A", "\u001B[[5~"]);
    });

    it("parses legacy and standard CSI sequences mixed together", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[[A\u001B[B\u001B[[6~\u001B[1;5D"])).toStrictEqual(["\u001B[[A", "\u001B[B", "\u001B[[6~", "\u001B[1;5D"]);
    });

    it("holds incomplete CSI sequence until final byte arrives", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001B[")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.push("1;5")).toStrictEqual([]);
        expect(parser.push("A")).toStrictEqual(["\u001B[1;5A"]);
    });

    it("holds incomplete legacy ESC[[... sequence until final byte arrives", () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("\u001B[[")).toStrictEqual([]);
        expect(parser.push("5")).toStrictEqual([]);
        expect(parser.push("~")).toStrictEqual(["\u001B[[5~"]);
    });

    it("holds incomplete SS3 sequence until final byte arrives", () => {
        expect.assertions(2);

        const parser = createInputParser();

        expect(parser.push("\u001BO")).toStrictEqual([]);
        expect(parser.push("A")).toStrictEqual(["\u001BOA"]);
    });

    it("holds incomplete double-escape CSI sequence until final byte arrives", () => {
        expect.assertions(2);

        const parser = createInputParser();

        expect(parser.push("\u001B\u001B[")).toStrictEqual([]);
        expect(parser.push("A")).toStrictEqual(["\u001B\u001B[A"]);
    });

    it("keeps pending plain escape and can flush it", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001B")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.flushPendingEscape()).toBe("\u001B");
        expect(parser.hasPendingEscape()).toBe(false);
    });

    it("flushes pending CSI prefix as literal input", () => {
        expect.assertions(5);

        const parser = createInputParser();

        expect(parser.push("\u001B[")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.flushPendingEscape()).toBe("\u001B[");
        expect(parser.hasPendingEscape()).toBe(false);
        expect(parser.push("A")).toStrictEqual(["A"]);
    });

    it("reset clears pending input state", () => {
        expect.assertions(2);

        const parser = createInputParser();

        expect(parser.push("\u001B[")).toStrictEqual([]);

        parser.reset();

        expect(parser.push("A")).toStrictEqual(["A"]);
    });

    it("treats invalid CSI continuation as escaped code point plus plain text", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[\n"])).toStrictEqual(["\u001B[", "\n"]);
    });

    it("parses mixed text and many key events in one read", () => {
        expect.assertions(1);

        expect(parseChunks(["start\u001B[A mid \u001BOH end\u001B[[5~"])).toStrictEqual(["start", "\u001B[A", " mid ", "\u001BOH", " end", "\u001B[[5~"]);
    });

    it("flushes pending SS3 prefix as literal input", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001BO")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.flushPendingEscape()).toBe("\u001BO");
        expect(parser.push("x")).toStrictEqual(["x"]);
    });

    it("flushes pending legacy CSI prefix as literal input", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001B[[")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.flushPendingEscape()).toBe("\u001B[[");
        expect(parser.push("x")).toStrictEqual(["x"]);
    });

    it("parses meta+SS3 sequence with double escape", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B\u001BOA"])).toStrictEqual(["\u001B\u001BOA"]);
    });

    it("holds incomplete double-escape SS3 sequence until final byte arrives", () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("\u001B\u001BO")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.push("A")).toStrictEqual(["\u001B\u001BOA"]);
    });

    it("emits double escape as single event for non-control character", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B\u001Bx"])).toStrictEqual(["\u001B\u001B", "x"]);
    });

    it("empty chunk produces no events", () => {
        expect.assertions(1);

        expect(parseChunks([""])).toStrictEqual([]);
    });

    it("empty chunk does not disturb pending state", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001B[")).toStrictEqual([]);
        expect(parser.push("")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.push("A")).toStrictEqual(["\u001B[A"]);
    });

    it("plain text followed by incomplete escape holds escape as pending", () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("hello\u001B")).toStrictEqual(["hello"]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.flushPendingEscape()).toBe("\u001B");
    });

    const deleteAndBackspaceCases = [
        {
            chunks: ["\u007F\u007F\u007F"],
            events: ["\u007F", "\u007F", "\u007F"],
            title: "splits batched delete characters into individual events",
        },
        {
            chunks: ["\u0008\u0008\u0008"],
            events: ["\u0008", "\u0008", "\u0008"],
            title: "splits batched backspace characters into individual events",
        },
        {
            chunks: ["\u007F\u0008\u007F"],
            events: ["\u007F", "\u0008", "\u007F"],
            title: "splits mixed delete and backspace characters",
        },
        {
            chunks: ["abc\u007F\u007F\u007F"],
            events: ["abc", "\u007F", "\u007F", "\u007F"],
            title: "splits mixed printable text and delete characters",
        },
        {
            chunks: ["\u007F"],
            events: ["\u007F"],
            title: "single delete character is preserved as individual event",
        },
        {
            chunks: ["\u0008"],
            events: ["\u0008"],
            title: "single backspace character is preserved as individual event",
        },
        {
            chunks: ["abc\u007F"],
            events: ["abc", "\u007F"],
            title: "splits trailing delete from text",
        },
        {
            chunks: ["\u007F\u007F\u001B[A"],
            events: ["\u007F", "\u007F", "\u001B[A"],
            title: "splits delete characters before escape sequences",
        },
        {
            chunks: ["\u001B[A\u007F\u007F"],
            events: ["\u001B[A", "\u007F", "\u007F"],
            title: "splits delete characters after escape sequences",
        },
        {
            chunks: ["\u001B[A\u007F\u001B[B"],
            events: ["\u001B[A", "\u007F", "\u001B[B"],
            title: "splits delete characters between escape sequences",
        },
        {
            chunks: ["\u0008\u001B[A\u0008"],
            events: ["\u0008", "\u001B[A", "\u0008"],
            title: "splits backspace characters around escape sequences",
        },
        {
            chunks: ["ab\u007Fcd"],
            events: ["ab", "\u007F", "cd"],
            title: "splits interleaved text and delete characters",
        },
        {
            chunks: ["\rtest"],
            events: ["\rtest"],
            title: "does not split pasted carriage return from text",
        },
        {
            chunks: ["\ttest"],
            events: ["\ttest"],
            title: "does not split pasted tab from text",
        },
    ] as const;

    it.each(deleteAndBackspaceCases)("$title", (testCase) => {
        expect.assertions(1);

        expect(parseChunks(testCase.chunks)).toStrictEqual(testCase.events);
    });

    it("assembles CSI sequence from single-byte chunks", () => {
        expect.assertions(6);

        const parser = createInputParser();

        expect(parser.push("\u001B")).toStrictEqual([]);
        expect(parser.push("[")).toStrictEqual([]);
        expect(parser.push("1")).toStrictEqual([]);
        expect(parser.push(";")).toStrictEqual([]);
        expect(parser.push("5")).toStrictEqual([]);
        expect(parser.push("A")).toStrictEqual(["\u001B[1;5A"]);
    });

    it("emits paste event for bracketed paste sequence", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~hello world\u001B[201~"])).toStrictEqual([{ paste: "hello world" }]);
    });

    it("emits paste event for multiline bracketed paste", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~line1\nline2\u001B[201~"])).toStrictEqual([{ paste: "line1\nline2" }]);
    });

    it("paste content with escape sequences is delivered verbatim", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~hello\u001B[Aworld\u001B[201~"])).toStrictEqual([{ paste: "hello\u001B[Aworld" }]);
    });

    it("emits normal events before and after bracketed paste", () => {
        expect.assertions(1);

        expect(parseChunks(["before\u001B[200~pasted\u001B[201~after"])).toStrictEqual(["before", { paste: "pasted" }, "after"]);
    });

    it("emits multiple paste events in one chunk", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~first\u001B[201~mid\u001B[200~second\u001B[201~"])).toStrictEqual([{ paste: "first" }, "mid", { paste: "second" }]);
    });

    it("holds incomplete bracketed paste as pending", () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("\u001B[200~hello")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(false);
        expect(parser.push(" world\u001B[201~")).toStrictEqual([{ paste: "hello world" }]);
    });

    it("assembles bracketed paste from chunk-by-chunk delivery", () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("\u001B[200~")).toStrictEqual([]);
        expect(parser.push("hello")).toStrictEqual([]);
        expect(parser.push("\u001B[201~")).toStrictEqual([{ paste: "hello" }]);
    });

    it("emits empty paste for adjacent paste markers", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~\u001B[201~"])).toStrictEqual([{ paste: "" }]);
    });

    it(String.raw`handles pasteStart split before the tilde (\u001B[200 without ~)`, () => {
        expect.assertions(3);

        const parser = createInputParser();

        expect(parser.push("\u001B[200")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(false);
        expect(parser.push("~hello\u001B[201~")).toStrictEqual([{ paste: "hello" }]);
    });

    it(String.raw`hasPendingEscape returns true for length-3 pasteStart prefix (\u001B[2)`, () => {
        expect.assertions(2);

        const parser = createInputParser();

        expect(parser.push("\u001B[2")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
    });

    it(String.raw`hasPendingEscape returns true for length-4 pasteStart prefix (\u001B[20)`, () => {
        expect.assertions(2);

        const parser = createInputParser();

        expect(parser.push("\u001B[20")).toStrictEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
    });

    it("paste event delivers delete and backspace chars verbatim without splitting", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[200~\u007F\u0008\u007F\u001B[201~"])).toStrictEqual([{ paste: "\u007F\u0008\u007F" }]);
    });
});
