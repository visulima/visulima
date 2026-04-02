/* eslint-disable @typescript-eslint/explicit-member-accessibility, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, class-methods-use-this, consistent-return, default-case, import/exports-last, max-classes-per-file, no-bitwise, no-for-of-array/no-for-of-array, no-param-reassign, no-plusplus, prefer-const, sonarjs/cognitive-complexity */
import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { reduceAnsiCodesIncremental, tokenize } from "@alcalzone/ansi-tokenize";
import { getStringWidth, isFullwidthCodePoint, slice as sliceAnsi } from "@visulima/string";

import { CONTINUATION_CELL_CODE } from "./ansi-to-cell";
import type { OutputTransformer } from "./render-node-to-output";
import { FULL_WIDTH_MASK } from "./style-flags";
import { StyledLine } from "./styled-line";
import { ansiCodesToStyleInfo, styledCharsToStyledLine } from "./styled-line-bridge";
import { styledLineToString } from "./styled-line-serializer";

/**
 * "Virtual" output class
 *
 * Uses StyledLine (columnar data) internally instead of per-character StyledChar objects,
 * reducing GC pressure from ~80 objects/line to 1 string + 1 typed array + ~3 spans.
 */

type Options = {
    caches?: OutputCaches;
    height: number;
    width: number;
};

type Operation = WriteOperation | StyledWriteOperation | ClipOperation | UnclipOperation;

type WriteOperation = {
    text: string;
    transformers: OutputTransformer[];
    type: "write";
    x: number;
    y: number;
};

type StyledWriteOperation = {
    styledChars: StyledChar[];
    transformers: OutputTransformer[];
    type: "styledWrite";
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

    styledLines: Map<string, StyledLine> = new Map<string, StyledLine>();

    lines: Map<string, string[]> = new Map<string, string[]>();

    private readonly asciiStyledCharCache = new Map<string, StyledChar>();

    private readonly maxEntries: number;

    private readonly pruneToFactor: number;

    constructor(options: OutputCachesOptions = {}) {
        const { maxEntries = 30_000, pruneToFactor = 0.8 } = options;

        this.maxEntries = Math.max(1, maxEntries);
        this.pruneToFactor = Math.min(0.99, Math.max(0.1, pruneToFactor));
    }

    getStyledLine(line: string): StyledLine {
        let cached = this.styledLines.get(line);

        if (cached === undefined) {
            const chars = this.getStyledChars(line);

            cached = styledCharsToStyledLine(chars);
            this.setCacheEntry(this.styledLines, line, cached);
        }

        return cached;
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

        if (character.value.length === 1) {
            const code = character.value.codePointAt(0)!;

            if (code >= 0x20 && code <= 0x7e) {
                return 1;
            }
        }

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

    private readonly outputGrid: StyledLine[] = [];

    private readonly previousLines: StyledLine[] = [];

    private readonly previousRenderedLines: string[] = [];

    private readonly activeClipStack: Clip[] = [];

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
        this.activeClipStack.length = 0;
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

    writeStyledChars(x: number, y: number, styledChars: StyledChar[], options: { transformers: OutputTransformer[] }): void {
        if (styledChars.length === 0) {
            return;
        }

        this.operations.push({
            styledChars,
            transformers: options.transformers,
            type: "styledWrite",
            x,
            y,
        });
    }

    clip(clip: Clip): void {
        this.operations.push({
            clip,
            type: "clip",
        });
        this.activeClipStack.push(clip);
    }

    unclip(): void {
        this.operations.push({
            type: "unclip",
        });
        this.activeClipStack.pop();
    }

    getCurrentClip(): Clip | undefined {
        return this.activeClipStack.at(-1);
    }

    private replayOperations(output: StyledLine[]): void {
        const clips: Clip[] = [];

        for (const operation of this.operations) {
            switch (operation.type) {
                case "clip": {
                    clips.push(operation.clip);
                    break;
                }

                case "styledWrite": {
                    this.processStyledWriteOperation(operation, output, clips.at(-1));
                    break;
                }

                case "unclip": {
                    clips.pop();
                    break;
                }

                case "write": {
                    this.processWriteOperation(operation, output, clips.at(-1));
                    break;
                }
            }
        }
    }

    get(): { height: number; output: string } {
        const output = this.getOutputGrid();

        this.replayOperations(output);

        if (!this.lineMemoizationEnabled) {
            if (this.memoizationProbeCountdown > 0) {
                this.memoizationProbeCountdown--;
            } else {
                this.lineMemoizationEnabled = true;
            }
        }

        const canUseMemoization = this.lineMemoizationEnabled;
        const hasPrevious = this.previousLines.length > 0;
        const canReuseRows
            = canUseMemoization && hasPrevious && this.previousLines.length === output.length && this.previousRenderedLines.length === output.length;

        if (this.previousLines.length > output.length) {
            this.previousLines.length = output.length;
        }

        if (this.previousRenderedLines.length > output.length) {
            this.previousRenderedLines.length = output.length;
        }

        const generatedLines = new Array<string>(output.length);
        let changedRows = 0;

        for (let rowIndex = 0; rowIndex < output.length; rowIndex++) {
            const row = output[rowIndex]!;

            if (canReuseRows && this.previousLines[rowIndex] && this.previousLines[rowIndex]!.equals(row)) {
                generatedLines[rowIndex] = this.previousRenderedLines[rowIndex] ?? "";
                continue;
            }

            changedRows++;

            const trimmed = row.trimEnd();
            const renderedLine = styledLineToString(trimmed);

            generatedLines[rowIndex] = renderedLine;

            if (canUseMemoization) {
                this.previousRenderedLines[rowIndex] = renderedLine;
                this.previousLines[rowIndex] = row.clone();
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

    getBuffer(): { buffer: Uint32Array; height: number } {
        const output = this.getOutputGrid();

        this.replayOperations(output);

        const rows = output.length;
        const buffer = new Uint32Array(this.width * rows * 2);

        const defaultAttribute = (0 << 16) | (255 << 8) | 255;

        for (let index = 0; index < buffer.length; index += 2) {
            buffer[index] = 32;
            buffer[index + 1] = defaultAttribute;
        }

        for (let y = 0; y < rows; y++) {
            const row = output[y]!;

            for (let x = 0; x < row.length && x < this.width; x++) {
                const value = row.getValue(x);

                if (value.length === 0) {
                    continue;
                }

                const charCode = value.codePointAt(0) ?? 32;
                const bufIndex = (y * this.width + x) * 2;

                const span = row.getSpan(x);
                const formatFlags = span?.formatFlags ?? 0;
                const fgColor = span?.fgColor;
                const bgColor = span?.bgColor;

                const fg = fgColor ? colorNameToAnsi256(fgColor) : 255;
                const bg = bgColor ? colorNameToAnsi256(bgColor) : 255;
                const styleBits = formatFlags & 0xff;

                const attributeCode = (styleBits << 16) | ((bg & 0xff) << 8) | (fg & 0xff);

                buffer[bufIndex] = charCode;
                buffer[bufIndex + 1] = attributeCode;

                if (row.getFullWidth(x) && x + 1 < this.width) {
                    const nextIndex = bufIndex + 2;

                    buffer[nextIndex] = CONTINUATION_CELL_CODE;
                    buffer[nextIndex + 1] = attributeCode;
                    x++;
                }
            }
        }

        return { buffer, height: rows };
    }

    private processStyledWriteOperation(operation: StyledWriteOperation, output: StyledLine[], clip: Clip | undefined): void {
        const { styledChars, x, y } = operation;

        while (output.length <= y) {
            output.push(StyledLine.empty(this.width));
        }

        const row = output[y];

        if (!row) {
            return;
        }

        let col = x;

        for (const char of styledChars) {
            if (col < 0) {
                col++;
                continue;
            }

            if (col >= this.width) {
                break;
            }

            if (clip) {
                if (clip.x1 !== undefined && col < clip.x1) {
                    col++;
                    continue;
                }

                if (clip.x2 !== undefined && col >= clip.x2) {
                    break;
                }

                if (clip.y1 !== undefined && y < clip.y1) {
                    return;
                }

                if (clip.y2 !== undefined && y >= clip.y2) {
                    return;
                }
            }

            const { bgColor, fgColor, formatFlags, link } = ansiCodesToStyleInfo(char.styles);
            const flags = char.fullWidth ? formatFlags | FULL_WIDTH_MASK : formatFlags;

            row.setChar(col, char.value, flags, fgColor, bgColor, link);
            col++;

            if (char.fullWidth && col < this.width) {
                // Continuation cell inherits parent style so spans merge correctly
                row.setChar(col, "", formatFlags, fgColor, bgColor, link);
                col++;
            }
        }
    }

    private processWriteOperation(operation: WriteOperation, output: StyledLine[], clip: Clip | undefined) {
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

            this.writeLineToStyledLine(currentLine, prepared.x, line);
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
        const clippedLines: string[] = Array.from<string>({ length: lines.length }).fill("");

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

    private writeLineToStyledLine(row: StyledLine, x: number, line: string) {
        if (line.length === 0) {
            return;
        }

        const parsed = this.caches.getStyledLine(line);
        let offsetX = x;

        for (let i = 0; i < parsed.length; i++) {
            if (offsetX >= row.length) {
                break;
            }

            const value = parsed.getValue(i);
            const flags = parsed.getFormatFlags(i);
            const fgColor = parsed.getFgColor(i);
            const bgColor = parsed.getBgColor(i);
            const link = parsed.getLink(i);

            row.setChar(offsetX, value, flags, fgColor, bgColor, link);

            const isFullWidth = parsed.getFullWidth(i);

            if (isFullWidth) {
                offsetX++;

                if (offsetX < row.length) {
                    // Continuation cell inherits parent style so spans merge correctly
                    row.setChar(offsetX, "", flags & ~FULL_WIDTH_MASK, fgColor, bgColor, link);
                }
            }

            offsetX++;
        }
    }

    private getOutputGrid(): StyledLine[] {
        const { height, width } = this;

        if (this.outputGrid.length > height) {
            this.outputGrid.length = height;
        }

        for (let y = 0; y < height; y++) {
            this.outputGrid[y] = StyledLine.empty(width);
        }

        return this.outputGrid;
    }

    private disableLineMemoization() {
        this.lineMemoizationEnabled = false;
        this.memoizationProbeCountdown = memoizationProbeInterval;
        this.previousLines.length = 0;
        this.previousRenderedLines.length = 0;
    }
}

const colorNameToAnsi256 = (color: string): number => {
    const namedColors: Record<string, number> = {
        black: 0,
        blue: 4,
        cyan: 6,
        green: 2,
        magenta: 5,
        red: 1,
        white: 7,
        yellow: 3,
    };

    const brightColors: Record<string, number> = {
        blackBright: 8,
        blueBright: 12,
        cyanBright: 14,
        greenBright: 10,
        magentaBright: 13,
        redBright: 9,
        whiteBright: 15,
        yellowBright: 11,
    };

    const named = namedColors[color];

    if (named !== undefined) {
        return named;
    }

    const bright = brightColors[color];

    if (bright !== undefined) {
        return bright;
    }

    const ansi256Match = /^ansi256\(\s?(\d+)\s?\)$/.exec(color);

    if (ansi256Match) {
        return Number(ansi256Match[1]) & 0xff;
    }

    if (color.startsWith("#") && color.length === 7) {
        const r = Number.parseInt(color.slice(1, 3), 16);
        const g = Number.parseInt(color.slice(3, 5), 16);
        const b = Number.parseInt(color.slice(5, 7), 16);

        return 16 + 36 * Math.round(r / 51) + 6 * Math.round(g / 51) + Math.round(b / 51);
    }

    const rgbMatch = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/.exec(color);

    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);

        return 16 + 36 * Math.round(r / 51) + 6 * Math.round(g / 51) + Math.round(b / 51);
    }

    return 255;
};
