/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { Renderer } from "../src/core/index";

const COLS = 80;
const ROWS = 24;
const CELLS = COLS * ROWS;

const emptyBuffer = new Uint32Array(CELLS * 2);

const fullBuffer = new Uint32Array(CELLS * 2);

for (let index = 0; index < CELLS; index++) {
    fullBuffer[index * 2] = 65 + (index % 26);
    fullBuffer[index * 2 + 1] = (1 << 16) | (2 << 8) | 15;
}

const partialBuffer = new Uint32Array(fullBuffer);

for (let index = 0; index < CELLS * 0.05; index++) {
    const cell = (index * 37) % CELLS;

    partialBuffer[cell * 2] = 66 + (index % 26);
}

describe("Diff Engine", () => {
    bench("no changes (hot path)", () => {
        const renderer = new Renderer(COLS, ROWS);

        renderer.renderDiff(emptyBuffer);
        renderer.renderDiff(emptyBuffer);
    });

    bench("all cells dirty (first frame)", () => {
        const renderer = new Renderer(COLS, ROWS);

        renderer.renderDiff(fullBuffer);
    });

    bench("5% cells dirty (typical frame)", () => {
        const renderer = new Renderer(COLS, ROWS);

        renderer.renderDiff(fullBuffer);
        renderer.renderDiff(partialBuffer);
    });
});
