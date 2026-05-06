/* eslint-disable import/no-extraneous-dependencies */
import { createPatch, diffChars, diffWords, parsePatch } from "diff";
import { bench, describe } from "vitest";

const SMALL_OLD = "hello world";
const SMALL_NEW = "hello beautiful world";

const MEDIUM_OLD = Array.from({ length: 50 }, (_, i) => `line ${i + 1}: original content here`).join("\n");
const MEDIUM_NEW = Array.from({ length: 50 }, (_, i) => {
    if (i % 10 === 5) {
        return `line ${i + 1}: MODIFIED content here`;
    }

    if (i === 25) {
        return `line ${i + 1}: original content here\nnew inserted line`;
    }

    return `line ${i + 1}: original content here`;
}).join("\n");

const LARGE_OLD = Array.from({ length: 500 }, (_, i) => `line ${i + 1}: ${i % 2 === 0 ? "even" : "odd"} content data=${i * 7}`).join("\n");
const LARGE_NEW = Array.from({ length: 500 }, (_, i) => {
    if (i % 50 === 25) {
        return `line ${i + 1}: CHANGED content data=${i * 7}`;
    }

    return `line ${i + 1}: ${i % 2 === 0 ? "even" : "odd"} content data=${i * 7}`;
}).join("\n");

const MEDIUM_PATCH = createPatch("file", MEDIUM_OLD, MEDIUM_NEW, "old", "new", { context: 3 });
const LARGE_PATCH = createPatch("file", LARGE_OLD, LARGE_NEW, "old", "new", { context: 3 });

describe("createPatch", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("small (1 line change)", () => {
        createPatch("file", SMALL_OLD, SMALL_NEW, "old", "new", { context: 3 });
    });

    bench.skipIf(process.env.CODSPEED_ENV)("medium (50 lines, ~5 changes)", () => {
        createPatch("file", MEDIUM_OLD, MEDIUM_NEW, "old", "new", { context: 3 });
    });

    bench.skipIf(process.env.CODSPEED_ENV)("large (500 lines, ~10 changes)", () => {
        createPatch("file", LARGE_OLD, LARGE_NEW, "old", "new", { context: 3 });
    });
});

describe("parsePatch", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("medium patch", () => {
        parsePatch(MEDIUM_PATCH);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("large patch", () => {
        parsePatch(LARGE_PATCH);
    });
});

describe("diffChars (inline highlighting)", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("small line pair", () => {
        diffChars("const x = 'old';", "const x = 'new';");
    });

    bench.skipIf(process.env.CODSPEED_ENV)("medium line pair (100 chars)", () => {
        diffChars(
            "export function processData(input: DataInput, options: ProcessOptions): ProcessResult {",
            "export async function processData(input: DataInput, options?: ProcessOptions): Promise<ProcessResult> {",
        );
    });

    bench.skipIf(process.env.CODSPEED_ENV)("long line pair (500 chars)", () => {
        const longOld = `${"a".repeat(250)}OLD${"b".repeat(247)}`;
        const longNew = `${"a".repeat(250)}NEW${"b".repeat(247)}`;

        diffChars(longOld, longNew);
    });
});

describe("diffWords (prose highlighting)", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("sentence pair", () => {
        diffWords("The quick brown fox jumps over the lazy dog", "The fast brown fox leaps over the sleepy dog");
    });

    bench.skipIf(process.env.CODSPEED_ENV)("paragraph pair", () => {
        diffWords(
            "This is the first version of the paragraph. It contains several sentences. Each sentence has some important words.",
            "This is the second version of the paragraph. It contains many sentences. Each sentence has some modified words.",
        );
    });
});
