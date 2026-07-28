import { bgRed, red } from "@visulima/colorize";
import { getStringWidth } from "@visulima/string";
import terminalSize from "terminal-size";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BorderStyleName } from "../../src";
import { boxen, boxes, clearTerminalSizeCache } from "../../src";

const TUPLE_ERROR = /must return a \[width, height\] tuple/;
const NUMBER_ERROR = /both width and height must be numbers/;

vi.mock(import("terminal-size"), () => {
    return {
        default: vi.fn<() => { columns: number; rows: number }>(() => {
            return {
                columns: 80,
                rows: 24,
            };
        }),
    };
});

const terminalSizeMock = vi.mocked(terminalSize);

// The terminal-size probe is memoized at module scope, so its state would
// otherwise leak across tests (and, under shared module state, across files).
// Reset it before and after every test so each one starts from a cold probe
// and the call-count assertions stay independent of execution order. These are
// intentionally file-level so every describe block is covered.
// eslint-disable-next-line vitest/require-top-level-describe
beforeEach(() => {
    clearTerminalSizeCache();
    terminalSizeMock.mockClear();
});

// eslint-disable-next-line vitest/require-top-level-describe
afterEach(() => {
    clearTerminalSizeCache();
});

describe("validation", () => {
    it.each([["borderColor"], ["textColor"], ["backgroundColor"], ["headerTextColor"], ["footerTextColor"]] as const)(
        "throws a helpful TypeError when %s is not a function",
        (key) => {
            expect.assertions(1);

            expect(() => boxen("foo", { [key]: "nope" })).toThrow(`"${key}" must be a function, got string`);
        },
    );

    it("throws when fullscreen is not a boolean or function", () => {
        expect.assertions(1);

        expect(() => boxen("foo", { fullscreen: 42 } as never)).toThrow(`"fullscreen" must be a boolean or a function`);
    });

    it("throws when fullscreen callback returns an invalid shape", () => {
        expect.assertions(1);

        expect(() => boxen("foo", { fullscreen: (() => "nope") as never })).toThrow(TUPLE_ERROR);
    });

    it("throws when fullscreen callback returns non-numeric dimensions", () => {
        expect.assertions(1);

        expect(() => boxen("foo", { fullscreen: () => [Number.NaN, 10] })).toThrow(NUMBER_ERROR);
    });
});

describe("fullscreen callback shapes", () => {
    it("accepts a [width, height] tuple", () => {
        expect.assertions(2);

        const box = boxen("foo", { fullscreen: (width, height) => [width, height] });
        const lines = box.split("\n");

        // 80 columns wide, 24 rows tall.
        expect(lines).toHaveLength(24);
        expect(getStringWidth(lines[0] as string)).toBe(80);
    });

    it("accepts a { columns, rows } object", () => {
        expect.assertions(2);

        const box = boxen("foo", {
            fullscreen: (width, height) => {
                return { columns: width, rows: height };
            },
        });
        const lines = box.split("\n");

        expect(lines).toHaveLength(24);
        expect(getStringWidth(lines[0] as string)).toBe(80);
    });

    it("tuple and object forms produce identical output", () => {
        expect.assertions(1);

        const tuple = boxen("foo bar", { fullscreen: (width, height) => [width - 4, height - 2] });
        const object = boxen("foo bar", {
            fullscreen: (width, height) => {
                return { columns: width - 4, rows: height - 2 };
            },
        });

        expect(tuple).toBe(object);
    });
});

describe("terminalColumns / terminalRows overrides", () => {
    it("uses terminalColumns instead of probing terminal-size", () => {
        expect.assertions(1);

        const box = boxen("hello world this is a long sentence that wraps", { terminalColumns: 20 });
        const widest = Math.max(...box.split("\n").map((line) => getStringWidth(line)));

        expect(widest).toBeLessThanOrEqual(20);
    });

    it("uses terminalRows for fullscreen height", () => {
        expect.assertions(1);

        const box = boxen("foo", { fullscreen: true, terminalColumns: 10, terminalRows: 6 });

        expect(box.split("\n")).toHaveLength(6);
    });

    it("does not probe terminal-size when terminalColumns is provided", () => {
        expect.assertions(1);

        boxen("hello world", { terminalColumns: 20 });

        expect(terminalSizeMock).not.toHaveBeenCalled();
    });

    it("produces deterministic output for a given terminalColumns regardless of the real terminal", () => {
        expect.assertions(1);

        const first = boxen("hello world this is a long sentence that wraps", { terminalColumns: 24 });
        const second = boxen("hello world this is a long sentence that wraps", { terminalColumns: 24 });

        expect(first).toBe(second);
    });
});

describe("terminal-size probe caching", () => {
    it("probes terminal-size only once across multiple renders", () => {
        expect.assertions(1);

        boxen("foo");
        boxen("bar");
        boxen("baz");

        expect(terminalSizeMock).toHaveBeenCalledTimes(1);
    });

    it("re-probes after clearTerminalSizeCache()", () => {
        expect.assertions(2);

        boxen("foo");

        expect(terminalSizeMock).toHaveBeenCalledTimes(1);

        clearTerminalSizeCache();
        boxen("bar");

        expect(terminalSizeMock).toHaveBeenCalledTimes(2);
    });

    it("does not probe at all when both terminalColumns and terminalRows are supplied", () => {
        expect.assertions(1);

        boxen("foo", { fullscreen: true, terminalColumns: 40, terminalRows: 10 });

        expect(terminalSizeMock).not.toHaveBeenCalled();
    });
});

describe("verticalAlignment", () => {
    // Strip the left/right border characters to inspect only the inner content.
    const interior = (box: string): string[] =>
        box
            .split("\n")
            .slice(1, -1)
            .map((line) => line.slice(1, -1).trim());

    it("aligns content to the top by default", () => {
        expect.assertions(2);

        const lines = interior(boxen("X", { height: 5 }));

        expect(lines[0]).toBe("X");
        expect(lines.at(-1)).toBe("");
    });

    it("centers content vertically", () => {
        expect.assertions(3);

        const lines = interior(boxen("X", { height: 5, verticalAlignment: "center" }));

        expect(lines[0]).toBe("");
        expect(lines[1]).toBe("X");
        expect(lines.at(-1)).toBe("");
    });

    it("aligns content to the bottom", () => {
        expect.assertions(2);

        const lines = interior(boxen("X", { height: 5, verticalAlignment: "bottom" }));

        expect(lines[0]).toBe("");
        expect(lines.at(-1)).toBe("X");
    });
});

describe("backgroundColor", () => {
    it("wraps each interior content line", () => {
        expect.assertions(2);

        const box = boxen("foo", { backgroundColor: (line) => bgRed(line) });

        // bgRed opens with the background-red ANSI code.
        expect(box).toContain("[41m");
        // Plain text is preserved alongside the styling.
        expect(box).toContain("foo");
    });

    it("does not alter the border characters", () => {
        expect.assertions(1);

        const box = boxen("foo", { backgroundColor: (line) => bgRed(line) });

        expect(box.split("\n")[0]).not.toContain("[41m");
    });
});

describe("boxes catalog export", () => {
    it("exposes the built-in border styles", () => {
        expect.assertions(2);

        expect(boxes.round.topLeft).toBe("╭");
        expect(boxes.double.bottomRight).toBe("╝");
    });

    it("can derive a custom border from a built-in one", () => {
        expect.assertions(1);

        const box = boxen("foo", { borderStyle: { ...boxes.round, top: "=" } });

        expect(box.split("\n")[0]).toContain("=");
    });

    it("exposes a runtime entry for every declared BorderStyleName", () => {
        expect.assertions(1);

        const names: BorderStyleName[] = ["arrow", "bold", "classic", "double", "doubleSingle", "none", "round", "single", "singleDouble"];

        expect(names.every((name) => name in boxes)).toBe(true);
    });

    it("exposes an empty-character none entry matching its type", () => {
        expect.assertions(2);

        expect(boxes.none).toBeDefined();
        expect(boxes.none.topLeft).toBe("");
    });
});

describe("borderColor positions", () => {
    it("only emits the eight documented border positions", () => {
        expect.assertions(1);

        const seen = new Set<string>();

        boxen("foo bar", {
            borderColor: (border, position) => {
                seen.add(position);

                return border;
            },
            footerText: "bye",
            headerText: "hi",
        });

        expect([...seen].toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["bottom", "bottomLeft", "bottomRight", "left", "right", "top", "topLeft", "topRight"]);
    });
});

describe("regression: header/footer colors still apply", () => {
    it("colors the header text", () => {
        expect.assertions(1);

        const box = boxen("foo", { headerText: "hi", headerTextColor: (t) => red(t) });

        expect(box).toContain("[31m");
    });
});
