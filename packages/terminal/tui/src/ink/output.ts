/* eslint-disable @typescript-eslint/no-use-before-define, class-methods-use-this, no-bitwise */
import { getStringWidth } from "@visulima/string";

import { CONTINUATION_CELL_CODE } from "./ansi-to-cell";
import { colorToAnsi256 } from "./color-utils";
import type { Region } from "./region";
import type { OutputTransformer } from "./render-node-to-output";
import { FULL_WIDTH_MASK } from "./style-flags";
import { StyledLine } from "./styled-line";
import { plainTextToStyledLine, textToStyledLine } from "./styled-line-factory";
import { styledLineToString } from "./styled-line-serializer";

/**
 * "Virtual" output class — immediate-write model.
 *
 * Writes go directly to the StyledLine grid instead of being queued
 * as operations and replayed later. This eliminates the operation queue
 * allocation and iteration overhead.
 */

type Options = {
    caches?: OutputCaches;
    height: number;
    width: number;
};

type Clip = {
    x1: number | undefined;
    x2: number | undefined;
    y1: number | undefined;
    y2: number | undefined;
};

type OutputCachesOptions = {
    maxEntries?: number;
    pruneToFactor?: number;
};

export class OutputCaches {
    widths: Map<string, number> = new Map<string, number>();

    blockWidths: Map<string, number> = new Map<string, number>();

    styledLines: Map<string, StyledLine> = new Map<string, StyledLine>();

    lines: Map<string, string[]> = new Map<string, string[]>();

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
            cached = this.hasAnsiControlMarker(line) ? textToStyledLine(line) : plainTextToStyledLine(line);
            this.setCacheEntry(this.styledLines, line, cached);
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

const ansiControlMarkerCodePoints = new Set<number>([27, 144, 152, 155, 157, 158, 159]);

const memoizationDisableRatio = 0.6;
const memoizationProbeInterval = 30;

export default class Output {
    width: number;

    height: number;

    private readonly caches: OutputCaches;

    // Single flat grid — all writes go directly here, clipped by bounds.
    private grid: StyledLine[];

    // Clip stack — bounds for writes. No child region allocation or compositing.
    private readonly clipStack: Clip[] = [];

    private readonly previousLines: StyledLine[] = [];

    private readonly previousRenderedLines: string[] = [];

    private lineMemoizationEnabled = true;

    private memoizationProbeCountdown = 0;

    constructor(options: Options) {
        const { caches, height, width } = options;

        this.width = Math.round(width);
        this.height = Math.round(height);
        this.caches = caches ?? new OutputCaches();
        this.grid = this.createGrid(this.width, this.height);
    }

    reset(width: number, height: number): void {
        this.width = Math.round(width);
        this.height = Math.round(height);
        this.clipStack.length = 0;
        this.grid = this.createGrid(this.width, this.height);
    }

    startChildRegion(absX: number, absY: number, width: number, height: number): void {
        const x1 = Math.round(absX);
        const y1 = Math.round(absY);

        this.clipStack.push({ x1, x2: x1 + Math.round(width), y1, y2: y1 + Math.round(height) });
    }

    endChildRegion(): void {
        this.clipStack.pop();
    }

    write(x: number, y: number, text: string, options: { transformers: OutputTransformer[] }): void {
        if (!text) {
            return;
        }

        const { transformers } = options;
        const clip = this.clipStack.at(-1);
        const lines = this.caches.getLines(text);
        const hasTransformers = transformers.length > 0;

        for (const [lineIndex, rawLine] of lines.entries()) {
            const rowIndex = y + lineIndex;

            if (rowIndex < 0 || rowIndex >= this.grid.length) {
                continue;
            }

            if (clip && (rowIndex < clip.y1! || rowIndex >= clip.y2!)) {
                continue;
            }

            let line = rawLine;

            if (hasTransformers) {
                for (const transformer of transformers) {
                    line = transformer(line, lineIndex);
                }
            }

            if (line.length === 0) {
                continue;
            }

            const row = this.grid[rowIndex]!;
            const parsed = this.caches.getStyledLine(line);
            let offsetX = x;

            // When not clipped, allow writes beyond terminal width by growing the row
            const maxX = clip ? Math.min(clip.x2!, row.length) : Infinity;

            const parsedSpans = parsed.getSpans();
            let spanCursor = 0;
            let spanEnd = parsedSpans[0]?.length ?? 0;

            for (let i = 0; i < parsed.length; i++) {
                while (spanCursor < parsedSpans.length && i >= spanEnd) {
                    spanCursor++;
                    spanEnd += parsedSpans[spanCursor]?.length ?? 0;
                }

                if (offsetX >= maxX) {
                    break;
                }

                if (clip && (offsetX < clip.x1! || offsetX >= clip.x2!)) {
                    offsetX++;

                    if (parsed.getFullWidth(i)) {
                        offsetX++;
                    }

                    continue;
                }

                if (offsetX >= 0) {
                    // Grow row if writing beyond current length (no clip active)
                    if (offsetX >= row.length) {
                        row.ensureWidth(offsetX + 2);
                    }

                    const span = parsedSpans[spanCursor];
                    const isFullWidth = parsed.getFullWidth(i);
                    const flags = (span?.formatFlags ?? 0) | (isFullWidth ? FULL_WIDTH_MASK : 0);

                    row.setCharFast(offsetX, parsed.getValue(i), flags, span?.fgColor, span?.bgColor, span?.link);

                    if (isFullWidth) {
                        offsetX++;

                        if (offsetX >= row.length) {
                            row.ensureWidth(offsetX + 1);
                        }

                        row.setCharFast(offsetX, "", flags & ~FULL_WIDTH_MASK, span?.fgColor, span?.bgColor, span?.link);
                    }
                }

                offsetX++;
            }
        }
    }

    writeStyledLine(x: number, y: number, line: StyledLine): void {
        if (line.length === 0 || y < 0 || y >= this.grid.length) {
            return;
        }

        const clip = this.clipStack.at(-1);

        if (clip && (y < clip.y1! || y >= clip.y2!)) {
            return;
        }

        this.writeStyledLineToRow(this.grid[y]!, x, line, this.width, clip);
    }

    getRootLines(): ReadonlyArray<StyledLine> {
        return this.grid;
    }

    getCurrentClip(): Clip | undefined {
        return this.clipStack.at(-1);
    }

    addRegionTree(region: Region, x: number, y: number): void {
        for (let ry = 0; ry < region.height; ry++) {
            const targetY = y + ry;

            if (targetY < 0 || targetY >= this.grid.length) {
                continue;
            }

            const srcLine = region.lines[ry];

            if (!srcLine) {
                continue;
            }

            const destinationRow = this.grid[targetY]!;

            const srcSpans = srcLine.getSpans();
            let spanCursor = 0;
            let spanEnd = srcSpans[0]?.length ?? 0;

            for (let rx = 0; rx < srcLine.length; rx++) {
                while (spanCursor < srcSpans.length && rx >= spanEnd) {
                    spanCursor++;
                    spanEnd += srcSpans[spanCursor]?.length ?? 0;
                }

                const targetX = x + rx;

                if (targetX < 0 || targetX >= destinationRow.length) {
                    continue;
                }

                const value = srcLine.getValue(rx);
                const span = srcSpans[spanCursor];
                const hasStyles
                    = (span !== undefined && (span.formatFlags & ~FULL_WIDTH_MASK) !== 0)
                    || span?.fgColor !== undefined
                    || span?.bgColor !== undefined
                    || span?.link !== undefined;

                if (value !== " " || hasStyles) {
                    const flags = (span?.formatFlags ?? 0) | (srcLine.getFullWidth(rx) ? FULL_WIDTH_MASK : 0);

                    destinationRow.setCharFast(targetX, value, flags, span?.fgColor, span?.bgColor, span?.link);
                }
            }
        }

        for (const child of region.children) {
            this.addRegionTree(child, x + child.x, y + child.y);
        }
    }

    private writeStyledLineToRow(row: StyledLine, x: number, source: StyledLine, maxWidth: number, clip?: Clip): void {
        let col = x;
        const effectiveMax = clip ? Math.min(clip.x2!, maxWidth) : Infinity;

        const sourceSpans = source.getSpans();
        let spanCursor = 0;
        let spanEnd = sourceSpans[0]?.length ?? 0;

        for (let i = 0; i < source.length; i++) {
            while (spanCursor < sourceSpans.length && i >= spanEnd) {
                spanCursor++;
                spanEnd += sourceSpans[spanCursor]?.length ?? 0;
            }

            if (col >= effectiveMax) {
                break;
            }

            if (clip && (col < clip.x1! || col >= clip.x2!)) {
                col++;

                if (source.getFullWidth(i)) {
                    col++;
                }

                continue;
            }

            if (col >= 0) {
                // Grow row if writing beyond current length (no clip active)
                if (col >= row.length) {
                    row.ensureWidth(col + 2);
                }

                const span = sourceSpans[spanCursor];
                const isFullWidth = source.getFullWidth(i);
                const flags = (span?.formatFlags ?? 0) | (isFullWidth ? FULL_WIDTH_MASK : 0);

                row.setCharFast(col, source.getValue(i), flags, span?.fgColor, span?.bgColor, span?.link);

                if (isFullWidth) {
                    col++;

                    if (col >= row.length) {
                        row.ensureWidth(col + 1);
                    }

                    row.setCharFast(col, "", flags & ~FULL_WIDTH_MASK, span?.fgColor, span?.bgColor, span?.link);
                }
            }

            col++;
        }
    }

    get(): { height: number; output: string } {
        const output = this.grid;

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

        const generatedLines = Array.from({ length: output.length });
        let changedRows = 0;

        for (const [rowIndex, element] of output.entries()) {
            const row = element;

            if (canReuseRows && this.previousLines[rowIndex]?.equals(row)) {
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
        const output = this.grid;
        const rows = output.length;
        const buffer = new Uint32Array(this.width * rows * 2);

        const defaultAttribute = (0 << 16) | (255 << 8) | 255;

        for (let index = 0; index < buffer.length; index += 2) {
            buffer[index] = 32;
            buffer[index + 1] = defaultAttribute;
        }

        for (let y = 0; y < rows; y++) {
            const row = output[y]!;

            const rowSpans = row.getSpans();
            let spanCursor = 0;
            let spanEnd = rowSpans[0]?.length ?? 0;

            for (let x = 0; x < row.length && x < this.width; x++) {
                while (spanCursor < rowSpans.length && x >= spanEnd) {
                    spanCursor++;
                    spanEnd += rowSpans[spanCursor]?.length ?? 0;
                }

                const value = row.getValue(x);

                if (value.length === 0) {
                    continue;
                }

                const charCode = value.codePointAt(0) ?? 32;
                const bufIndex = (y * this.width + x) * 2;

                const span = rowSpans[spanCursor];
                const formatFlags = span?.formatFlags ?? 0;
                const fgColor = span?.fgColor;
                const bgColor = span?.bgColor;

                const fg = fgColor ? colorToAnsi256(fgColor) : 255;
                const bg = bgColor ? colorToAnsi256(bgColor) : 255;
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

    private createGrid(width: number, height: number): StyledLine[] {
        const grid: StyledLine[] = [];

        for (let y = 0; y < height; y++) {
            grid.push(StyledLine.empty(width));
        }

        return grid;
    }

    private disableLineMemoization() {
        this.lineMemoizationEnabled = false;
        this.memoizationProbeCountdown = memoizationProbeInterval;
        this.previousLines.length = 0;
        this.previousRenderedLines.length = 0;
    }
}
