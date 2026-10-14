import { cursorTo } from "@visulima/ansi";
import { getStringWidth } from "@visulima/string";
import { describe, expect, it } from "vitest";

import { changedLineUpdate } from "../../src/ink/line-update";
import logUpdate from "../../src/ink/log-update";
import createStdout from "../helpers/ink-create-stdout";
import type { Pen, Screen } from "../helpers/ink-screen";
import { renderFrames, visibleRows } from "../helpers/ink-screen";

const ESC = "\u001B[";
const RESET = `${ESC}0m`;

// Linear congruential generator, so every randomized case is reproducible from its seed.
const createRandom = (seed: number) => {
    let state = seed >>> 0;

    return (): number => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;

        return state / 2 ** 32;
    };
};

type Random = () => number;

const pick = <T,>(random: Random, items: ReadonlyArray<T>): T => items[Math.floor(random() * items.length)]!;

const WORDS = ["alpha", "beta", "x", "42", "--", " ", "status"];
const WIDE = ["界面", "👩‍💻", "🇨🇳", "👍🏽", "é", "1️⃣", "é", "🚀"];
const OPENERS = [`${ESC}31m`, `${ESC}1;32m`, `${ESC}38;5;208m`, `${ESC}38;2;10;20;30m`, `${ESC}48;5;22m`, `${ESC}3m${ESC}4m`, `${ESC}7m`];
const INNER = ["", `${ESC}39m`, `${ESC}22m`, `${ESC}38;5;100m`, `${ESC}49m`];

// Every token leaves the default style behind it, so a row always starts from the same state.
const randomToken = (random: Random): string => {
    const roll = random();

    if (roll < 0.45) {
        return pick(random, WORDS);
    }

    if (roll < 0.7) {
        return pick(random, WIDE);
    }

    return `${pick(random, OPENERS)}${pick(random, WORDS)}${pick(random, INNER)}${pick(random, WORDS)}${RESET}`;
};

const MAX_WIDTH = 36;

// eslint-disable-next-line no-control-regex -- SGR starts with ESC.
const SGR_PATTERN = /\u001B\[[\d;]*m/gu;

const plainWidth = (text: string): number => getStringWidth(text.replaceAll(SGR_PATTERN, ""));

const buildRow = (tokens: string[]): string => {
    const kept: string[] = [];

    for (const token of tokens) {
        if (plainWidth([...kept, token].join("")) > MAX_WIDTH) {
            break;
        }

        kept.push(token);
    }

    return kept.join("");
};

const randomTokens = (random: Random): string[] => Array.from({ length: Math.floor(random() * 6) }, () => randomToken(random));

/** Changes a row the way a live UI does: unchanged, extended, one token edited, or replaced. */
const mutateTokens = (random: Random, tokens: string[]): string[] => {
    const roll = random();

    if (roll < 0.25) {
        return tokens;
    }

    if (roll < 0.6) {
        return [...tokens.slice(0, Math.floor(random() * (tokens.length + 1))), ...randomTokens(random)];
    }

    if (roll < 0.8 && tokens.length > 0) {
        const edited = [...tokens];

        edited[Math.floor(random() * edited.length)] = randomToken(random);

        return edited;
    }

    return randomTokens(random);
};

const CHARACTERS = ["Q", "界", "é", "-", "👍🏽"];

/** Replaces one visible character anywhere in the row, so the first difference can land inside a span or a wide character. */
const editCharacter = (random: Random, row: string): string => {
    // eslint-disable-next-line no-control-regex -- matches SGR sequences to skip them.
    const cells = [...row.matchAll(/\u001B\[[\d;]*m|[\s\S]/gu)].filter((match) => !match[0].startsWith("\u001B"));

    if (cells.length === 0) {
        return row;
    }

    const target = cells[Math.floor(random() * cells.length)]!;
    const edited = row.slice(0, target.index) + pick(random, CHARACTERS) + row.slice(target.index + target[0].length);

    return plainWidth(edited) <= MAX_WIDTH ? edited : row;
};

const randomFrames = (random: Random): string[] => {
    const frames: string[] = [];
    let rows = Array.from({ length: 1 + Math.floor(random() * 4) }, () => randomTokens(random));

    for (let frame = 0; frame < 3; frame += 1) {
        frames.push(
            rows.map((tokens) => (random() < 0.3 ? editCharacter(random, buildRow(tokens)) : buildRow(tokens))).join("\n") + (random() < 0.7 ? "\n" : ""),
        );

        rows = Array.from({ length: 1 + Math.floor(random() * 4) }, (_, index) =>
            (index < rows.length && random() < 0.8 ? mutateTokens(random, rows[index]!) : randomTokens(random)));
    }

    return frames;
};

/**
 * Everything a user can see: characters and the pen of every cell, plus the cursor row, since the next frame is laid out
 * from it. The cursor column is left out on purpose: when the last row is unchanged, the incremental writer leaves the
 * cursor at column 0 while a whole rewrite leaves it at the end of the row. That predates prefix skipping.
 */
const screenGrid = (screen: Screen) => {
    return {
        cells: screen.rows.map((row, y) => row.map((char, x) => { return { char, pen: screen.styles[y]![x] }; })),
        cursorRow: screen.cursorY,
    };
};

const penAt = (screen: Screen, row: number, column: number): Pen => screen.styles[row]![column]!;

describe("incremental rendering matches a whole-line rewrite", () => {
    it("produces the same screen for randomized before and after frames", () => {
        expect.assertions(500);

        for (let seed = 1; seed <= 500; seed += 1) {
            const frames = randomFrames(createRandom(seed));
            const incremental = renderFrames(frames, { incremental: true });
            const whole = renderFrames(frames, { incremental: false });

            expect(screenGrid(incremental), `seed ${seed}: ${JSON.stringify(frames)}`).toEqual(screenGrid(whole));
        }
    });

    it("produces the same screen when a hyperlink or a wide character sits before the change", () => {
        expect.assertions(3);

        const cases = [
            [`${ESC}0m\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007 1`, `${ESC}0m\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007 2`],
            ["界面 a", "界面 b"],
            ["👩‍💻 ok", "👩‍🔬 ok"],
        ];

        for (const [before, after] of cases) {
            expect(screenGrid(renderFrames([before, after], { incremental: true }))).toEqual(screenGrid(renderFrames([before, after], { incremental: false })));
        }
    });
});

describe("incremental rendering writes less for a small change", () => {
    const stableRow = `${"UNCHANGED LEFT ".repeat(3)}${ESC}1mCounter: 0${RESET}`;

    const bytesWrittenForSecondFrame = (columns: number | undefined): { bytes: string; length: number } => {
        const stdout = createStdout(100, true, 12);

        // An unknown width takes the whole-line path, which is the output before prefix skipping.
        (stdout as { columns?: number }).columns = columns;

        const render = logUpdate.create(stdout, { incremental: true, showCursor: true });

        render(`${stableRow}\n`);

        const firstFrameWrites = stdout.getWrites().length;

        render(`${stableRow.replace("0", "1")}\n`);

        const bytes = stdout.getWrites().slice(firstFrameWrites).join("");

        return { bytes, length: bytes.length };
    };

    it("writes only the changed cell and far fewer bytes than the whole line", () => {
        expect.assertions(3);

        const partial = bytesWrittenForSecondFrame(100);
        const whole = bytesWrittenForSecondFrame(undefined);

        expect(partial.bytes).not.toContain("UNCHANGED LEFT");
        expect(partial.length).toBeLessThan(whole.length);
        expect(partial.length).toBeLessThan(whole.length / 2);
    });
});

describe("incremental rendering keeps the style of the unchanged prefix", () => {
    it("restores bold and colour set before the cut and then cleared", () => {
        expect.assertions(3);

        const screen = renderFrames([`${ESC}1m${ESC}38;5;208mAB${ESC}22mC${RESET}`, `${ESC}1m${ESC}38;5;208mAB${ESC}22mD${RESET}`]);

        expect(visibleRows(screen)[1]).toBe("ABD");
        expect(penAt(screen, 1, 0)).toMatchObject({ bold: true, fg: "5;208" });
        expect(penAt(screen, 1, 2)).toMatchObject({ bold: false, fg: "5;208" });
    });

    it("does not let a background opened before the cut leak into the changed cells", () => {
        expect.assertions(3);

        const screen = renderFrames([`${ESC}43mhello${RESET} World`, `${ESC}43mhello${RESET} Wor!`]);

        expect(visibleRows(screen)[1]).toBe("hello Wor!");
        expect(penAt(screen, 1, 0)).toMatchObject({ bg: "43" });
        expect(penAt(screen, 1, 9)).toMatchObject({ bg: "" });
    });

    it("repaints every cell when only the colour of an unchanged word differs", () => {
        expect.assertions(5);

        const screen = renderFrames([`${ESC}31mword${RESET}`, `${ESC}32mword${RESET}`]);

        expect(visibleRows(screen)[1]).toBe("word");

        for (let column = 0; column < 4; column += 1) {
            expect(penAt(screen, 1, column)).toMatchObject({ fg: "32" });
        }
    });
});

describe("changedLineUpdate writes exactly the changed part of a row", () => {
    const lineUpdate = changedLineUpdate;

    it("skips an unchanged left region", () => {
        expect.assertions(1);

        expect(lineUpdate("UNCHANGED LEFT      Counter: 0", "UNCHANGED LEFT      Counter: 1", 60)).toBe(`${cursorTo(29)}1`);
    });

    it("replays nested styles and extended colours at the changed column", () => {
        expect.assertions(1);

        const prefix = `${ESC}1m${ESC}38;2;10;20;30munchanged ${ESC}22m${ESC}48;5;100mleft `;
        const suffix = `${ESC}49m${ESC}39m`;

        expect(lineUpdate(`${prefix}0${suffix}`, `${prefix}1${suffix}`, 80)).toBe(`${cursorTo(15)}${ESC}1m${ESC}38;2;10;20;30m${ESC}22m${ESC}48;5;100m1${suffix}`);
    });

    it("repaints the affected text when only its style changes", () => {
        expect.assertions(2);

        expect(lineUpdate(`unchanged ${ESC}31mword${ESC}39m`, `unchanged ${ESC}32mword${ESC}39m`, 80)).toBe(`${cursorTo(10)}${ESC}32mword${ESC}39m`);
        expect(lineUpdate(`unchanged ${ESC}38;2;10;20;30mword`, `unchanged ${ESC}38;2;10;20;31mword`, 80)).toBe(`${cursorTo(10)}${ESC}38;2;10;20;31mword`);
    });

    it.each([
        ["界面 ", 5],
        ["👩‍💻 ", 3],
        ["🇨🇳 ", 3],
        ["👍🏽 ", 3],
        ["é ", 2],
        ["1️⃣ ", 3],
    ])("measures unchanged graphemes in terminal cells: %j", (prefix, width) => {
        expect.assertions(1);

        expect(lineUpdate(`${prefix}old`, `${prefix}new`, 80)).toBe(`${cursorTo(width)}new`);
    });

    it.each([
        ["e", "é"],
        ["é", "e"],
        ["👩‍💻", "👩‍🔬"],
        ["👍🏽", "👍🏻"],
        ["🇨🇳", "🇨🇦"],
    ])("repaints a changed grapheme as a whole: %j -> %j", (previous, next) => {
        expect.assertions(1);

        expect(lineUpdate(`unchanged ${previous}`, `unchanged ${next}`, 80)).toBe(cursorTo(10) + next);
    });

    it("keeps a grapheme intact when an SGR sequence occurs inside it", () => {
        expect.assertions(1);

        expect(lineUpdate(`unchanged e${ESC}31ḿ`, `unchanged e${ESC}32ḿ`, 80)).toBe(`${cursorTo(10)}e${ESC}32ḿ`);
    });

    it("keeps the trailing reset when a styled line is shortened", () => {
        expect.assertions(1);

        expect(lineUpdate(`${ESC}31munchanged longer${ESC}39m`, `${ESC}31munchanged${ESC}39m`, 80)).toBe(`${cursorTo(9)}${ESC}31m${ESC}39m`);
    });

    it.each(["\t", "\r", "\b", "\u0007", `${ESC}2C`, "\u001B]8;;https://example.com\u0007", "\u001BPdata\u001B\\", "\u009B31m"])(
        "rewrites the whole row for the control %j",
        (control) => {
            expect.assertions(2);

            expect(lineUpdate(`unchanged ${control}old`, `unchanged ${control}new`, 80)).toBe(`${cursorTo(0)}unchanged ${control}new`);
            expect(lineUpdate(`unchanged ${control}old`, "unchanged new", 80)).toBe(`${cursorTo(0)}unchanged new`);
        },
    );

    it("rewrites the whole row when the cut is at the right margin", () => {
        expect.assertions(1);

        const next = `1234567890${ESC}0m`;

        expect(lineUpdate("1234567890", next, 10)).toBe(cursorTo(0) + next);
    });

    it("rewrites the whole row when the changed suffix would run past the right margin", () => {
        expect.assertions(1);

        expect(lineUpdate("1234 ab", "1234 cdef", 8)).toBe(`${cursorTo(0)}1234 cdef`);
    });

    it("updates the last cell without moving past the right margin", () => {
        expect.assertions(1);

        expect(lineUpdate("1234567890", "1234567891", 10)).toBe(`${cursorTo(9)}1`);
    });

    it("rewrites the whole row when the width is unknown or the row would wrap", () => {
        expect.assertions(3);

        for (const columns of [undefined, 0, 5]) {
            expect(lineUpdate("unchanged old", "unchanged new", columns)).toBe(`${cursorTo(0)}unchanged new`);
        }
    });

    it("prefers the shorter sequence for a short prefix", () => {
        expect.assertions(2);

        expect(lineUpdate("a0", "a1", 80)).toBe(`${cursorTo(1)}1`);
        expect(lineUpdate(`${ESC}31m0`, `${ESC}32m0`, 80)).toBe(`${cursorTo(0)}${ESC}32m0`);
    });
});
