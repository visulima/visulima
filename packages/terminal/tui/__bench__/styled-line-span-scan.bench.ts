/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { StyledLine } from "../src/ink/styled-line";

// Builds a wide row whose styling is broken into many distinct spans, so that
// getSpan()'s O(spans) linear scan is expensive when called per-character.
// This mirrors the hot render write loops in output.ts (Output.write,
// writeStyledLineToRow, getBuffer, addRegionTree).
const buildLine = (width: number, spanCount: number): StyledLine => {
    const line = new StyledLine();
    const groupSize = Math.max(1, Math.floor(width / spanCount));

    for (let index = 0; index < width; index++) {
        const group = Math.floor(index / groupSize);
        // Alternate a few foreground colors so adjacent spans never merge.
        const fgColor = `#${(((group % 6) + 1) * 0x10_10_10).toString(16).padStart(6, "0")}`;

        line.pushChar("a", 0, fgColor);
    }

    return line;
};

// Previous approach: one O(spans) linear scan per character.
const sumWidthsLinearScan = (line: StyledLine): number => {
    let total = 0;

    for (let i = 0; i < line.length; i++) {
        const span = line.getSpan(i);

        total += (span?.formatFlags ?? 0) + (span?.fgColor === undefined ? 0 : 1);
    }

    return total;
};

// Optimized approach: monotonic span cursor, O(chars + spans) total.
const sumWidthsCursor = (line: StyledLine): number => {
    let total = 0;
    const spans = line.getSpans();
    let spanCursor = 0;
    let spanEnd = spans[0]?.length ?? 0;

    for (let i = 0; i < line.length; i++) {
        while (spanCursor < spans.length && i >= spanEnd) {
            spanCursor++;
            spanEnd += spans[spanCursor]?.length ?? 0;
        }

        const span = spans[spanCursor];

        total += (span?.formatFlags ?? 0) + (span?.fgColor === undefined ? 0 : 1);
    }

    return total;
};

describe("StyledLine per-character span lookup", () => {
    describe("80 cols, 40 spans", () => {
        const line = buildLine(80, 40);

        bench("getSpan() per char (linear scan)", () => {
            sumWidthsLinearScan(line);
        });

        bench("monotonic span cursor", () => {
            sumWidthsCursor(line);
        });
    });

    describe("200 cols, 100 spans", () => {
        const line = buildLine(200, 100);

        bench("getSpan() per char (linear scan)", () => {
            sumWidthsLinearScan(line);
        });

        bench("monotonic span cursor", () => {
            sumWidthsCursor(line);
        });
    });

    describe("500 cols, 250 spans", () => {
        const line = buildLine(500, 250);

        bench("getSpan() per char (linear scan)", () => {
            sumWidthsLinearScan(line);
        });

        bench("monotonic span cursor", () => {
            sumWidthsCursor(line);
        });
    });
});
