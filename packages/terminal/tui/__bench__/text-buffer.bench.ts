/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

const splitLines = (text: string): string[] => {
    const result = text.split("\n");

    return result.length === 0 ? [""] : result;
};

const joinLines = (lines: string[]): string => lines.join("\n");

const SMALL_DOC = "Hello, world!";
const MEDIUM_DOC = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: Some content here with words and characters.`).join("\n");
const LARGE_DOC = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}: ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(2)}`).join("\n");

describe("Text Buffer Operations", () => {
    describe("splitLines / joinLines", () => {
        bench("split small (1 line)", () => {
            splitLines(SMALL_DOC);
        });

        bench("split medium (100 lines)", () => {
            splitLines(MEDIUM_DOC);
        });

        bench("split large (1000 lines)", () => {
            splitLines(LARGE_DOC);
        });

        const mediumLines = splitLines(MEDIUM_DOC);
        const largeLines = splitLines(LARGE_DOC);

        bench("join medium (100 lines)", () => {
            joinLines(mediumLines);
        });

        bench("join large (1000 lines)", () => {
            joinLines(largeLines);
        });
    });

    describe("Line insert (simulating typing)", () => {
        bench("insert char at end of 100-line doc", () => {
            const lines = splitLines(MEDIUM_DOC);
            const lastIndex = lines.length - 1;
            const line = lines[lastIndex]!;

            lines[lastIndex] = `${line}x`;
        });

        bench("insert char in middle of 100-line doc", () => {
            const lines = splitLines(MEDIUM_DOC);
            const midIndex = Math.floor(lines.length / 2);
            const line = lines[midIndex]!;
            const col = Math.floor(line.length / 2);

            lines[midIndex] = `${line.slice(0, col)}x${line.slice(col)}`;
        });
    });

    describe("Newline insert (simulating Enter)", () => {
        bench("split line in middle of 100-line doc", () => {
            const lines = [...splitLines(MEDIUM_DOC)];
            const midIndex = Math.floor(lines.length / 2);
            const line = lines[midIndex]!;
            const col = Math.floor(line.length / 2);
            const before = line.slice(0, col);
            const after = line.slice(col);

            lines.splice(midIndex, 1, before, after);
        });
    });

    describe("Delete line", () => {
        bench("delete middle line from 100-line doc", () => {
            const lines = [...splitLines(MEDIUM_DOC)];

            lines.splice(50, 1);
        });

        bench("delete middle line from 1000-line doc", () => {
            const lines = [...splitLines(LARGE_DOC)];

            lines.splice(500, 1);
        });
    });

    describe("Selection text extraction", () => {
        bench("extract 10 lines from 100-line doc", () => {
            const lines = splitLines(MEDIUM_DOC);
            const startLine = 20;
            const endLine = 30;
            const result: string[] = [];

            result.push(lines[startLine]!.slice(10));

            for (let i = startLine + 1; i < endLine; i++) {
                result.push(lines[i]!);
            }

            result.push(lines[endLine]!.slice(0, 15));
            result.join("\n");
        });

        bench("extract 100 lines from 1000-line doc", () => {
            const lines = splitLines(LARGE_DOC);
            const startLine = 200;
            const endLine = 300;
            const result: string[] = [];

            result.push(lines[startLine]!.slice(10));

            for (let i = startLine + 1; i < endLine; i++) {
                result.push(lines[i]!);
            }

            result.push(lines[endLine]!.slice(0, 15));
            result.join("\n");
        });
    });

    describe("Undo snapshot (array clone)", () => {
        bench("snapshot 100-line doc", () => {
            const lines = splitLines(MEDIUM_DOC);

            void [...lines];
        });

        bench("snapshot 1000-line doc", () => {
            const lines = splitLines(LARGE_DOC);

            void [...lines];
        });
    });
});
