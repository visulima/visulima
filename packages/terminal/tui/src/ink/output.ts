/* eslint-disable @typescript-eslint/explicit-member-accessibility, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, class-methods-use-this, consistent-return, default-case, import/exports-last, max-classes-per-file, no-for-of-array/no-for-of-array, no-param-reassign, no-plusplus, prefer-const, sonarjs/cognitive-complexity */
import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { ansiCodesToString, diffAnsiCodes, reduceAnsiCodesIncremental, tokenize } from "@alcalzone/ansi-tokenize";
import { getStringWidth, isFullwidthCodePoint, slice as sliceAnsi } from "@visulima/string";

import type { OutputTransformer } from "./render-node-to-output";

/**
 * "Virtual" output class
 *
 * Handles the positioning and saving of the output of each node in the tree. Also responsible for applying transformations to each character of the output.
 *
 * Used to generate the final output of all nodes before writing it to actual output stream (e.g. stdout)
 */

type Options = {
    caches?: OutputCaches;
    height: number;
    width: number;
};

type Operation = WriteOperation | ClipOperation | UnclipOperation;

type WriteOperation = {
    text: string;
    transformers: OutputTransformer[];
    type: "write";
    x: number;
    y: number;
};

type ClipOperation = {
    clip: Clip;
    type: "clip";
};

type Clip = {
    x1: number | undefined;
    x2: number | undefined;
    y1: number | undefined;
    y2: number | undefined;
};

type UnclipOperation = {
    type: "unclip";
};

type OutputCachesOptions = {
    maxEntries?: number;
    pruneToFactor?: number;
};

type PreparedWrite = {
    lines: string[];
    x: number;
    y: number;
};

export class OutputCaches {
    widths: Map<string, number> = new Map<string, number>();

    blockWidths: Map<string, number> = new Map<string, number>();

    styledChars: Map<string, StyledChar[]> = new Map<string, StyledChar[]>();

    lines: Map<string, string[]> = new Map<string, string[]>();

    private readonly asciiStyledCharCache = new Map<string, StyledChar>();

    private readonly maxEntries: number;

    private readonly pruneToFactor: number;

    constructor(options: OutputCachesOptions = {}) {
        const { maxEntries = 30_000, pruneToFactor = 0.8 } = options;

        this.maxEntries = Math.max(1, maxEntries);
        this.pruneToFactor = Math.min(0.99, Math.max(0.1, pruneToFactor));
    }

    getStyledChars(line: string): StyledChar[] {
        let cached = this.styledChars.get(line);

        if (cached === undefined) {
            cached = this.hasAnsiControlMarker(line) ? this.getAnsiStyledChars(line) : this.getPlainStyledChars(line);
            this.setCacheEntry(this.styledChars, line, cached);
        }

        return cached;
    }

    getStringWidth(text: string): number {
        let cached = this.widths.get(text);

        if (cached === undefined) {
            cached = getStringWidth(text);
            this.setCacheEntry(this.widths, text, cached);
        }

        return cached;
    }

    getCharacterWidth(character: StyledChar): number {
        if (character.fullWidth) {
            return 2;
        }

        // Fast path for printable ASCII graphemes.
        if (character.value.length === 1) {
            const code = character.value.codePointAt(0)!;

            if (code >= 0x20 && code <= 0x7e) {
                return 1;
            }
        }

        // Fallback for non-ASCII and complex graphemes.
        return Math.max(1, this.getStringWidth(character.value));
    }

    getWidestLine(text: string): number {
        let cached = this.blockWidths.get(text);

        if (cached === undefined) {
            let lineWidth = 0;

            for (const line of this.getLines(text)) {
                lineWidth = Math.max(lineWidth, this.getStringWidth(line));
            }

            cached = lineWidth;
            this.setCacheEntry(this.blockWidths, text, cached);
        }

        return cached;
    }

    getLines(text: string): string[] {
        let cached = this.lines.get(text);

        if (cached === undefined) {
            cached = text.split("\n");
            this.setCacheEntry(this.lines, text, cached);
        }

        return cached;
    }

    private hasAnsiControlMarker(text: string): boolean {
        for (const character of text) {
            const codePoint = character.codePointAt(0)!;

            if (ansiControlMarkerCodePoints.has(codePoint)) {
                return true;
            }
        }

        return false;
    }

    private getAnsiStyledChars(text: string): StyledChar[] {
        let activeStyles: StyledChar["styles"] = noStyles;
        const styledChars: StyledChar[] = [];

        for (const token of tokenize(text)) {
            if (token.type === "ansi") {
                activeStyles = reduceAnsiCodesIncremental(activeStyles, [token]);

                if (activeStyles.length === 0) {
                    activeStyles = noStyles;
                }

                continue;
            }

            if (token.type === "char") {
                styledChars.push({
                    fullWidth: token.fullWidth,
                    styles: activeStyles,
                    type: token.type,
                    value: token.value,
                });
            }
        }

        return styledChars;
    }

    private getPlainStyledChars(text: string): StyledChar[] {
        if (asciiPrintableRegex.test(text)) {
            return Array.from(text, (character) => this.getAsciiStyledChar(character));
        }

        const styledChars: StyledChar[] = [];

        for (const { segment } of plainTextSegmenter.segment(text)) {
            const codePoint = segment.codePointAt(0)!;

            styledChars.push({
                fullWidth: this.isFullwidthGrapheme(segment, codePoint),
                styles: noStyles,
                type: "char",
                value: segment,
            });
        }

        return styledChars;
    }

    private getAsciiStyledChar(character: string): StyledChar {
        let cached = this.asciiStyledCharCache.get(character);

        if (cached === undefined) {
            cached = {
                fullWidth: false,
                styles: noStyles,
                type: "char",
                value: character,
            };
            this.asciiStyledCharCache.set(character, cached);
        }

        return cached;
    }

    private isFullwidthGrapheme(grapheme: string, codePoint: number): boolean {
        if (isFullwidthCodePoint(codePoint)) {
            return true;
        }

        if (grapheme.includes("\uFE0F")) {
            return true;
        }

        if (codePoint >= regionalIndicatorStart && codePoint <= regionalIndicatorEnd) {
            return true;
        }

        return false;
    }

    private setCacheEntry<T>(cache: Map<string, T>, key: string, value: T) {
        if (!cache.has(key) && cache.size >= this.maxEntries) {
            this.pruneCache(cache);
        }

        cache.set(key, value);
    }

    private pruneCache<T>(cache: Map<string, T>) {
        const targetSize = Math.floor(this.maxEntries * this.pruneToFactor);

        for (const existingKey of cache.keys()) {
            cache.delete(existingKey);

            if (cache.size <= targetSize) {
                break;
            }
        }
    }
}

const blankCell: StyledChar = {
    fullWidth: false,
    styles: [],
    type: "char",
    value: " ",
};

const noStyles: StyledChar["styles"] = [];
const asciiPrintableRegex = /^[\u0020-\u007E]*$/;
const ansiControlMarkerCodePoints = new Set<number>([27, 144, 152, 155, 157, 158, 159]);
const plainTextSegmenter = new Intl.Segmenter(undefined, {
    granularity: "grapheme",
});
const regionalIndicatorStart = 127_462;
const regionalIndicatorEnd = 127_487;

const memoizationDisableRatio = 0.6;
const memoizationProbeInterval = 30;

export default class Output {
    width: number;

    height: number;

    private readonly operations: Operation[] = [];

    private readonly caches: OutputCaches;

    private readonly outputGrid: StyledChar[][] = [];

    private readonly previousLineCells: StyledChar[][] = [];

    private readonly previousRenderedLines: string[] = [];

    private readonly continuationCellCache = new WeakMap<StyledChar, StyledChar>();

    private readonly stylePrefixCache = new WeakMap<StyledChar["styles"], string>();

    private readonly styleTransitionCache = new WeakMap<StyledChar["styles"], WeakMap<StyledChar["styles"], string>>();

    private lineMemoizationEnabled = true;

    private memoizationProbeCountdown = 0;

    constructor(options: Options) {
        const { caches, height, width } = options;

        this.width = width;
        this.height = height;
        this.caches = caches ?? new OutputCaches();
    }

    reset(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.operations.length = 0;
    }

    write(x: number, y: number, text: string, options: { transformers: OutputTransformer[] }): void {
        const { transformers } = options;

        if (!text) {
            return;
        }

        this.operations.push({
            text,
            transformers,
            type: "write",
            x,
            y,
        });
    }

    clip(clip: Clip): void {
        this.operations.push({
            clip,
            type: "clip",
        });
    }

    unclip(): void {
        this.operations.push({
            type: "unclip",
        });
    }

    get(): { height: number; output: string } {
        if (!this.lineMemoizationEnabled) {
            if (this.memoizationProbeCountdown > 0) {
                this.memoizationProbeCountdown--;
            } else {
                this.lineMemoizationEnabled = true;
            }
        }

        const output = this.getOutputGrid();

        const clips: Clip[] = [];

        for (const operation of this.operations) {
            switch (operation.type) {
                case "clip": {
                    clips.push(operation.clip);
                    break;
                }

                case "unclip": {
                    clips.pop();
                    break;
                }

                case "write": {
                    const clip = clips.at(-1);

                    this.processWriteOperation(operation, output, clip);
                    break;
                }
            }
        }

        if (this.previousLineCells.length > output.length) {
            this.previousLineCells.length = output.length;
        }

        if (this.previousRenderedLines.length > output.length) {
            this.previousRenderedLines.length = output.length;
        }

        const canUseMemoization = this.lineMemoizationEnabled;
        const canReuseRows = canUseMemoization && this.previousLineCells.length === output.length && this.previousRenderedLines.length === output.length;

        const generatedLines = Array.from({ length: output.length }).fill("");
        let changedRows = 0;

        for (const [rowIndex, row] of output.entries()) {
            const previousRow = canReuseRows ? this.previousLineCells[rowIndex] : undefined;

            if (canReuseRows && this.isSameRow(row, previousRow)) {
                generatedLines[rowIndex] = this.previousRenderedLines[rowIndex] ?? "";
                continue;
            }

            changedRows++;

            const renderedLine = this.renderRow(row);

            generatedLines[rowIndex] = renderedLine;

            if (canUseMemoization) {
                this.previousRenderedLines[rowIndex] = renderedLine;
                this.copyRowSnapshot(row, rowIndex);
            }
        }

        if (canUseMemoization && canReuseRows && output.length > 0) {
            const changedRatio = changedRows / output.length;

            if (changedRatio > memoizationDisableRatio) {
                this.disableLineMemoization();
            }
        }

        return {
            height: output.length,
            output: generatedLines.join("\n"),
        };
    }

    private processWriteOperation(operation: WriteOperation, output: StyledChar[][], clip: Clip | undefined) {
        const prepared = this.prepareWrite(operation, clip);

        if (!prepared) {
            return;
        }

        const hasTransformers = operation.transformers.length > 0;

        for (let lineIndex = 0; lineIndex < prepared.lines.length; lineIndex++) {
            const rowIndex = prepared.y + lineIndex;

            if (rowIndex < 0) {
                continue;
            }

            if (rowIndex >= output.length) {
                break;
            }

            const currentLine = output[rowIndex];

            if (!currentLine) {
                continue;
            }

            let line = prepared.lines[lineIndex] ?? "";

            if (hasTransformers) {
                line = this.applyTransformers(line, operation.transformers, lineIndex);
            }

            this.writeLineToOutput(currentLine, prepared.x, line);
        }
    }

    private prepareWrite(operation: WriteOperation, clip: Clip | undefined): PreparedWrite | undefined {
        let { text, x, y } = operation;
        let lines = this.caches.getLines(text);

        if (!clip) {
            return { lines, x, y };
        }

        const clipHorizontally = typeof clip.x1 === "number" && typeof clip.x2 === "number";
        const clipVertically = typeof clip.y1 === "number" && typeof clip.y2 === "number";

        if (clipHorizontally) {
            const clipX1 = clip.x1!;
            const clipX2 = clip.x2!;
            const width = this.caches.getWidestLine(text);

            if (x + width < clipX1 || x > clipX2) {
                return;
            }
        }

        if (clipVertically) {
            const clipY1 = clip.y1!;
            const clipY2 = clip.y2!;
            const height = lines.length;

            if (y + height < clipY1 || y > clipY2) {
                return;
            }
        }

        if (clipHorizontally) {
            const clipped = this.applyHorizontalClip(lines, x, clip.x1!, clip.x2!);

            lines = clipped.lines;
            x = clipped.x;
        }

        if (clipVertically) {
            const clipped = this.applyVerticalClip(lines, y, clip.y1!, clip.y2!);

            lines = clipped.lines;
            y = clipped.y;
        }

        return { lines, x, y };
    }

    private applyHorizontalClip(lines: string[], x: number, x1: number, x2: number): { lines: string[]; x: number } {
        const clippedLines = Array.from({ length: lines.length }).fill("");

        for (const [lineIndex, line] of lines.entries()) {
            const from = x < x1 ? x1 - x : 0;
            const width = this.caches.getStringWidth(line);
            const to = x + width > x2 ? x2 - x : width;

            clippedLines[lineIndex] = from === 0 && to === width ? line : sliceAnsi(line, from, to);
        }

        return {
            lines: clippedLines,
            x: Math.max(x, x1),
        };
    }

    private applyVerticalClip(lines: string[], y: number, y1: number, y2: number): { lines: string[]; y: number } {
        const from = y < y1 ? y1 - y : 0;
        const height = lines.length;
        const to = y + height > y2 ? y2 - y : height;
        const clippedLines = from > 0 || to < height ? lines.slice(from, to) : lines;

        return {
            lines: clippedLines,
            y: Math.max(y, y1),
        };
    }

    private applyTransformers(line: string, transformers: OutputTransformer[], lineIndex: number): string {
        let transformedLine = line;

        for (const transformer of transformers) {
            transformedLine = transformer(transformedLine, lineIndex);
        }

        return transformedLine;
    }

    private writeLineToOutput(currentLine: StyledChar[], x: number, line: string) {
        if (line.length === 0) {
            return;
        }

        const characters = this.caches.getStyledChars(line);
        let offsetX = x;

        for (const character of characters) {
            currentLine[offsetX] = character;

            const characterWidth = this.getCharacterWidthForRender(character);

            if (characterWidth > 1) {
                const continuationCell = this.getContinuationCell(character);

                for (let continuationIndex = 1; continuationIndex < characterWidth; continuationIndex++) {
                    currentLine[offsetX + continuationIndex] = continuationCell;
                }
            }

            offsetX += characterWidth;
        }
    }

    private getOutputGrid(): StyledChar[][] {
        if (this.outputGrid.length > this.height) {
            this.outputGrid.length = this.height;
        }

        for (let y = 0; y < this.height; y++) {
            const existing = this.outputGrid[y];
            const row = existing ?? [];

            if (!existing) {
                this.outputGrid[y] = row;
            }

            if (row.length !== this.width) {
                row.length = this.width;
            }

            row.fill(blankCell);
        }

        return this.outputGrid;
    }

    private isSameRow(currentRow: StyledChar[], previousRow: StyledChar[] | undefined): boolean {
        if (previousRow?.length !== currentRow.length) {
            return false;
        }

        for (const [index, currentCell] of currentRow.entries()) {
            if (currentCell !== previousRow[index]) {
                return false;
            }
        }

        return true;
    }

    private copyRowSnapshot(row: StyledChar[], rowIndex: number) {
        const snapshot = this.previousLineCells[rowIndex] ?? [];

        if (snapshot.length !== row.length) {
            snapshot.length = row.length;
        }

        for (const [index, cell] of row.entries()) {
            snapshot[index] = cell;
        }

        this.previousLineCells[rowIndex] = snapshot;
    }

    private renderRow(row: StyledChar[]): string {
        if (this.hasStyledCells(row)) {
            return this.renderStyledRow(row);
        }

        return this.renderUnstyledRow(row);
    }

    private hasStyledCells(row: StyledChar[]): boolean {
        for (const cell of row) {
            if (cell?.styles.length) {
                return true;
            }
        }

        return false;
    }

    private renderUnstyledRow(row: StyledChar[]): string {
        let line = "";

        for (const cell of row) {
            if (cell) {
                line += cell.value;
            }
        }

        return line.trimEnd();
    }

    private renderStyledRow(row: StyledChar[]): string {
        let line = "";
        let previousStyles: StyledChar["styles"] | undefined;

        for (const cell of row) {
            if (!cell) {
                continue;
            }

            const { styles, value } = cell;

            if (previousStyles === undefined) {
                line += this.getStylePrefix(styles);
            } else if (previousStyles !== styles) {
                line += this.getStyleTransition(previousStyles, styles);
            }

            line += value;
            previousStyles = styles;
        }

        if (previousStyles !== undefined && previousStyles.length > 0) {
            line += this.getStyleTransition(previousStyles, noStyles);
        }

        return line.trimEnd();
    }

    private getStylePrefix(styles: StyledChar["styles"]): string {
        let cached = this.stylePrefixCache.get(styles);

        if (cached === undefined) {
            cached = ansiCodesToString(styles);
            this.stylePrefixCache.set(styles, cached);
        }

        return cached;
    }

    private getStyleTransition(fromStyles: StyledChar["styles"], toStyles: StyledChar["styles"]): string {
        let fromCache = this.styleTransitionCache.get(fromStyles);

        if (fromCache === undefined) {
            fromCache = new WeakMap<StyledChar["styles"], string>();
            this.styleTransitionCache.set(fromStyles, fromCache);
        }

        let cached = fromCache.get(toStyles);

        if (cached === undefined) {
            cached = ansiCodesToString(diffAnsiCodes(fromStyles, toStyles));
            fromCache.set(toStyles, cached);
        }

        return cached;
    }

    private getCharacterWidthForRender(character: StyledChar): number {
        if (character.fullWidth) {
            return 2;
        }

        if (character.value.length === 1) {
            return 1;
        }

        return this.caches.getCharacterWidth(character);
    }

    private getContinuationCell(character: StyledChar): StyledChar {
        const cached = this.continuationCellCache.get(character);

        if (cached) {
            return cached;
        }

        const continuationCell: StyledChar = {
            fullWidth: false,
            styles: character.styles,
            type: "char",
            value: "",
        };

        this.continuationCellCache.set(character, continuationCell);

        return continuationCell;
    }

    private disableLineMemoization() {
        this.lineMemoizationEnabled = false;
        this.memoizationProbeCountdown = memoizationProbeInterval;
        this.previousLineCells.length = 0;
        this.previousRenderedLines.length = 0;
    }
}
