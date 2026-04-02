/* eslint-disable @typescript-eslint/explicit-member-accessibility, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, class-methods-use-this, consistent-return, default-case, import/exports-last, max-classes-per-file, no-bitwise, no-for-of-array/no-for-of-array, no-param-reassign, no-plusplus, prefer-const, sonarjs/cognitive-complexity */
import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { reduceAnsiCodesIncremental, tokenize } from "@alcalzone/ansi-tokenize";
import { getStringWidth, isFullwidthCodePoint, slice as sliceAnsi } from "@visulima/string";

import { CONTINUATION_CELL_CODE } from "./ansi-to-cell";
import type { OutputTransformer } from "./render-node-to-output";
import { FULL_WIDTH_MASK } from "./style-flags";
import { StyledLine } from "./styled-line";
import { styledCharsToStyledLine } from "./styled-line-bridge";
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

type RegionEntry = {
    absX: number;
    absY: number;
    height: number;
    lines: StyledLine[];
    width: number;
};

export default class Output {
    width: number;

    height: number;

    private readonly caches: OutputCaches;

    // Root region — the full terminal screen.
    private rootRegion: RegionEntry;

    // Region stack — writes go to the top region.
    // The root region is always at index 0.
    private readonly regionStack: RegionEntry[] = [];

    private readonly previousLines: StyledLine[] = [];

    private readonly previousRenderedLines: string[] = [];

    private lineMemoizationEnabled = true;

    private memoizationProbeCountdown = 0;

    constructor(options: Options) {
        const { caches, height, width } = options;

        this.width = width;
        this.height = height;
        this.caches = caches ?? new OutputCaches();

        this.rootRegion = this.createRegionEntry(0, 0, width, height);
        this.regionStack.push(this.rootRegion);
    }

    reset(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.regionStack.length = 0;

        this.rootRegion = this.createRegionEntry(0, 0, width, height);
        this.regionStack.push(this.rootRegion);
    }

    /**
     * Push a child region onto the stack. Writes will be clipped to this
     * region's bounds until endChildRegion() is called.
     * Coordinates are absolute (matching caller convention).
     */
    startChildRegion(absX: number, absY: number, width: number, height: number): void {
        const child = this.createRegionEntry(absX, absY, width, height);

        this.regionStack.push(child);
    }

    /**
     * Pop the current child region and composite it onto its parent.
     */
    endChildRegion(): void {
        if (this.regionStack.length <= 1) {
            return;
        }

        const child = this.regionStack.pop()!;
        const parent = this.regionStack.at(-1)!;

        // Composite child lines onto parent at the child's absolute position
        // translated to parent-relative coordinates.
        const relX = child.absX - parent.absX;
        const relY = child.absY - parent.absY;

        for (let y = 0; y < child.lines.length; y++) {
            const targetY = relY + y;

            if (targetY < 0 || targetY >= parent.lines.length) {
                continue;
            }

            const srcLine = child.lines[y]!;
            const dstLine = parent.lines[targetY]!;

            for (let x = 0; x < srcLine.length; x++) {
                const targetX = relX + x;

                if (targetX < 0 || targetX >= dstLine.length) {
                    continue;
                }

                const value = srcLine.getValue(x);

                if (value !== " " || srcLine.hasStyles(x)) {
                    dstLine.setCharFast(
                        targetX,
                        value,
                        srcLine.getFormatFlags(x),
                        srcLine.getFgColor(x),
                        srcLine.getBgColor(x),
                        srcLine.getLink(x),
                    );
                }
            }
        }
    }

    /**
     * Write text to the active region. Coordinates are absolute;
     * translated to region-relative internally.
     */
    write(x: number, y: number, text: string, options: { transformers: OutputTransformer[] }): void {
        if (!text) {
            return;
        }

        const { transformers } = options;
        const region = this.getActiveRegion();
        const lines = this.caches.getLines(text);
        const relX = x - region.absX;
        const relY = y - region.absY;

        const hasTransformers = transformers.length > 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const rowIndex = relY + lineIndex;

            if (rowIndex < 0 || rowIndex >= region.lines.length) {
                continue;
            }

            let line = lines[lineIndex] ?? "";

            if (hasTransformers) {
                for (const transformer of transformers) {
                    line = transformer(line, lineIndex);
                }
            }

            if (line.length === 0) {
                continue;
            }

            const row = region.lines[rowIndex]!;
            const parsed = this.caches.getStyledLine(line);
            let offsetX = relX;

            for (let i = 0; i < parsed.length; i++) {
                if (offsetX >= region.width) {
                    break;
                }

                if (offsetX >= 0) {
                    row.setCharFast(offsetX, parsed.getValue(i), parsed.getFormatFlags(i), parsed.getFgColor(i), parsed.getBgColor(i), parsed.getLink(i));
                }

                if (parsed.getFullWidth(i)) {
                    offsetX++;

                    if (offsetX >= 0 && offsetX < region.width) {
                        row.setCharFast(offsetX, "", parsed.getFormatFlags(i) & ~FULL_WIDTH_MASK, parsed.getFgColor(i), parsed.getBgColor(i), parsed.getLink(i));
                    }
                }

                offsetX++;
            }
        }
    }

    /**
     * Write a StyledLine directly to the active region (fast path).
     * Coordinates are absolute; translated to region-relative internally.
     */
    writeStyledLine(x: number, y: number, line: StyledLine): void {
        const region = this.getActiveRegion();
        const relY = y - region.absY;

        if (line.length === 0 || relY < 0 || relY >= region.lines.length) {
            return;
        }

        const row = region.lines[relY]!;

        this.writeStyledLineToRow(row, x - region.absX, line, region.width);
    }

    /**
     * Write pre-tokenized StyledChar[] to the active region.
     * Coordinates are absolute; translated to region-relative internally.
     */
    writeStyledChars(x: number, y: number, styledChars: StyledChar[], options: { transformers: OutputTransformer[] }): void {
        const region = this.getActiveRegion();
        const relY = y - region.absY;

        if (styledChars.length === 0 || relY < 0 || relY >= region.lines.length) {
            return;
        }

        const row = region.lines[relY]!;
        const source = styledCharsToStyledLine(styledChars);

        this.writeStyledLineToRow(row, x - region.absX, source, region.width);
    }

    /**
     * Get the current clip bounds (from the active region's absolute position).
     * Used by render-node-to-output for visibility culling.
     */
    /**
     * Get the root region's lines (for creating cached Regions).
     */
    getRootLines(): readonly StyledLine[] {
        return this.rootRegion.lines;
    }

    getCurrentClip(): Clip | undefined {
        if (this.regionStack.length <= 1) {
            return undefined;
        }

        const region = this.getActiveRegion();

        return {
            x1: region.absX,
            x2: region.absX + region.width,
            y1: region.absY,
            y2: region.absY + region.height,
        };
    }

    /**
     * Composite a cached Region onto the current grid at position (x, y).
     * This is used by render caching (Phase 7) to graft a pre-rendered
     * subtree into the output without re-traversing the DOM.
     *
     * Uses Object.create() for zero-copy position adjustment — the cached
     * region's lines are shared by reference.
     */
    addRegionTree(region: import("./region").Region, x: number, y: number): void {
        const active = this.getActiveRegion();
        const relX = x - active.absX;
        const relY = y - active.absY;

        // Composite each line of the cached region onto the active region
        for (let ry = 0; ry < region.height; ry++) {
            const targetY = relY + ry;

            if (targetY < 0 || targetY >= active.lines.length) {
                continue;
            }

            const srcLine = region.lines[ry];

            if (!srcLine) {
                continue;
            }

            const dstRow = active.lines[targetY]!;

            for (let rx = 0; rx < srcLine.length; rx++) {
                const targetX = relX + rx;

                if (targetX < 0 || targetX >= dstRow.length) {
                    continue;
                }

                const value = srcLine.getValue(rx);

                // Only copy non-blank cells
                if (value !== " " || srcLine.hasStyles(rx)) {
                    dstRow.setCharFast(
                        targetX,
                        value,
                        srcLine.getFormatFlags(rx),
                        srcLine.getFgColor(rx),
                        srcLine.getBgColor(rx),
                        srcLine.getLink(rx),
                    );
                }
            }
        }

        // Recursively composite child regions
        for (const child of region.children) {
            this.addRegionTree(child, x + child.x, y + child.y);
        }
    }

    /**
     * Generate ANSI output from the grid. No replay step needed —
     * writes have already been applied directly.
     */
    /**
     * Get the active region (top of stack).
     */
    private getActiveRegion(): RegionEntry {
        return this.regionStack.at(-1) ?? this.rootRegion;
    }

    /**
     * Write a StyledLine source into a row at position x.
     */
    private writeStyledLineToRow(row: StyledLine, x: number, source: StyledLine, maxWidth: number): void {
        let col = x;

        for (let i = 0; i < source.length; i++) {
            if (col >= maxWidth) {
                break;
            }

            if (col >= 0) {
                const value = source.getValue(i);
                const flags = source.getFormatFlags(i);
                const fgColor = source.getFgColor(i);
                const bgColor = source.getBgColor(i);
                const link = source.getLink(i);

                row.setCharFast(col, value, flags, fgColor, bgColor, link);

                if (source.getFullWidth(i)) {
                    col++;

                    if (col >= 0 && col < maxWidth) {
                        row.setCharFast(col, "", flags & ~FULL_WIDTH_MASK, fgColor, bgColor, link);
                    }
                }
            }

            col++;
        }
    }

    get(): { height: number; output: string } {
        const output = this.rootRegion.lines;

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

    /**
     * Convert to Uint32Array for the native Rust renderer.
     */
    getBuffer(): { buffer: Uint32Array; height: number } {
        const output = this.rootRegion.lines;
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

    private createRegionEntry(absX: number, absY: number, width: number, height: number): RegionEntry {
        const lines: StyledLine[] = [];

        for (let y = 0; y < height; y++) {
            lines.push(StyledLine.empty(width));
        }

        return { absX, absY, height, lines, width };
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
