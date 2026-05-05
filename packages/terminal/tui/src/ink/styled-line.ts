/**
 * Columnar data structure for a single line of styled terminal text.
 *
 * Instead of one heap-allocated object per visible character, StyledLine stores:
 *
 * - `text: string` — concatenated raw character values
 * - `charData: number[]` — per-character: 30-bit offset into text | 1-bit full-width flag
 * - `spans: StyleSpan[]` — run-length encoded style information
 *
 * For an 80-column line this reduces allocations from ~80 objects to
 * 1 string + 1 array + typically 1-5 span objects.
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 * @license Apache-2.0
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-bitwise */

import { FULL_WIDTH_MASK, INVERSE_MASK } from "./style-flags";

export type StyleSpan = {
    bgColor?: string;
    fgColor?: string;
    formatFlags: number;
    length: number;
    link?: string;
};

const OFFSET_MASK = 0x3f_ff_ff_ff;
const FULL_WIDTH_FLAG = 0x40_00_00_00;

export class StyledLine {
    public length: number = 0;

    private static readonly emptyCache = new Map<number, StyledLine>();

    private text: string | undefined;

    private charData: number[] | undefined;

    private spans: StyleSpan[] | undefined;

    private _cachedTrimmedLength?: number;

    static empty(length: number): StyledLine {
        if (length <= 0) {
            return new StyledLine();
        }

        const cached = StyledLine.emptyCache.get(length);

        if (cached) {
            return cached.clone();
        }

        const line = new StyledLine();

        line.length = length;
        line.text = " ".repeat(length);
        line.charData = Array.from({ length });

        for (let i = 0; i < length; i++) {
            line.charData[i] = i;
        }

        line.spans = [{ formatFlags: 0, length }];
        line._cachedTrimmedLength = 0;

        Object.freeze(line.spans[0]);
        Object.freeze(line.spans);
        Object.freeze(line);

        StyledLine.emptyCache.set(length, line);

        return line.clone();
    }

    getValue(index: number): string {
        if (this.text === undefined || index < 0 || index >= this.length) {
            return "";
        }

        const start = this.charData![index]! & OFFSET_MASK;
        const end = index + 1 < this.length ? this.charData![index + 1]! & OFFSET_MASK : this.text.length;

        return this.text.slice(start, end);
    }

    /**
     * Get the raw text for a range of characters as a single string slice.
     * Much faster than calling getValue() per character.
     */
    getTextRange(start: number, end: number): string {
        if (this.text === undefined || start < 0 || end > this.length || start >= end) {
            return "";
        }

        const textStart = this.charData![start]! & OFFSET_MASK;
        const textEnd = end < this.length ? this.charData![end]! & OFFSET_MASK : this.text.length;

        return this.text.slice(textStart, textEnd);
    }

    getSpan(index: number): StyleSpan | undefined {
        if (this.spans === undefined || index < 0 || index >= this.length) {
            return undefined;
        }

        let current = 0;

        for (const span of this.spans) {
            if (index < current + span.length) {
                return span;
            }

            current += span.length;
        }

        return undefined;
    }

    getFullWidth(index: number): boolean {
        if (this.charData === undefined || index < 0 || index >= this.length) {
            return false;
        }

        return (this.charData[index]! & FULL_WIDTH_FLAG) !== 0;
    }

    hasStyles(index: number): boolean {
        const span = this.getSpan(index);

        if (!span) {
            return false;
        }

        return (span.formatFlags & ~FULL_WIDTH_MASK) !== 0 || span.fgColor !== undefined || span.bgColor !== undefined || span.link !== undefined;
    }

    getFormatFlags(index: number): number {
        let flags = this.getSpan(index)?.formatFlags ?? 0;

        if (this.getFullWidth(index)) {
            flags |= FULL_WIDTH_MASK;
        }

        return flags;
    }

    getFgColor(index: number): string | undefined {
        return this.getSpan(index)?.fgColor;
    }

    getBgColor(index: number): string | undefined {
        return this.getSpan(index)?.bgColor;
    }

    getLink(index: number): string | undefined {
        return this.getSpan(index)?.link;
    }

    setInverted(index: number, inverted: boolean): void {
        this._cachedTrimmedLength = undefined;
        this.updateSpanAt(index, (span) => {
            if (inverted) {
                span.formatFlags |= INVERSE_MASK;
            } else {
                span.formatFlags &= ~INVERSE_MASK;
            }
        });
    }

    setBackgroundColor(index: number, color: string | undefined): void {
        this._cachedTrimmedLength = undefined;
        this.updateSpanAt(index, (span) => {
            span.bgColor = color;
        });
    }

    setForegroundColor(index: number, color: string | undefined): void {
        this._cachedTrimmedLength = undefined;
        this.updateSpanAt(index, (span) => {
            span.fgColor = color;
        });
    }

    setChar(index: number, value: string, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this._cachedTrimmedLength = undefined;
        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const start = this.charData![index]! & OFFSET_MASK;
        const end = index + 1 < this.length ? this.charData![index + 1]! & OFFSET_MASK : this.text!.length;
        const oldLength = end - start;
        const newLength = value.length;

        this.text = this.text!.slice(0, start) + value + this.text!.slice(end);

        if (oldLength !== newLength) {
            const diff = newLength - oldLength;

            for (let i = index + 1; i < this.length; i++) {
                const data = this.charData![i]!;
                const oldOffset = data & OFFSET_MASK;
                const fw = data & FULL_WIDTH_FLAG;

                this.charData![i] = (oldOffset + diff) | fw;
            }
        }

        this.charData![index] = start | (isFullWidth ? FULL_WIDTH_FLAG : 0);

        // Fast paths: style-already-matches (no-op) and merge-with-adjacent-span
        // avoid the splitSpansAt + mergeSpans roundtrip when possible.
        if (this.trySetStyleAtIndex(index, cleanFormatFlags, fgColor, bgColor, link)) {
            return;
        }

        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (let i = 0; i < this.spans!.length; i++) {
            const span = this.spans![i]!;

            if (current === index && span.length === 1) {
                this.spans![i] = {
                    bgColor,
                    fgColor,
                    formatFlags: cleanFormatFlags,
                    length: 1,
                    link,
                };
                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    /**
     * Optimized setChar for same-length single-byte replacement.
     * Skips string rebuild and offset adjustment when old and new values
     * have the same byte length (the common case for ASCII overwrites on empty lines).
     */
    setCharFast(index: number, value: string, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this._cachedTrimmedLength = undefined;
        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const start = this.charData![index]! & OFFSET_MASK;
        const end = index + 1 < this.length ? this.charData![index + 1]! & OFFSET_MASK : this.text!.length;
        const oldLength = end - start;

        // Fast path: same-length replacement (no offset adjustment needed)
        if (value.length === oldLength) {
            // Replace the character in the text string
            if (value !== this.text!.slice(start, end)) {
                this.text = this.text!.slice(0, start) + value + this.text!.slice(end);
            }

            this.charData![index] = start | (isFullWidth ? FULL_WIDTH_FLAG : 0);
        } else {
            // Slow path: different length, need offset adjustment
            this.text = this.text!.slice(0, start) + value + this.text!.slice(end);

            if (oldLength !== value.length) {
                const diff = value.length - oldLength;

                for (let i = index + 1; i < this.length; i++) {
                    const data = this.charData![i]!;

                    this.charData![i] = ((data & OFFSET_MASK) + diff) | (data & FULL_WIDTH_FLAG);
                }
            }

            this.charData![index] = start | (isFullWidth ? FULL_WIDTH_FLAG : 0);
        }

        // Fast paths: style-already-matches (no-op) and merge-with-adjacent-span
        // avoid the splitSpansAt + mergeSpans roundtrip when possible.
        if (this.trySetStyleAtIndex(index, cleanFormatFlags, fgColor, bgColor, link)) {
            return;
        }

        // Style changed — split, update, merge
        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (let i = 0; i < this.spans!.length; i++) {
            const span = this.spans![i]!;

            if (current === index && span.length === 1) {
                this.spans![i] = {
                    bgColor,
                    fgColor,
                    formatFlags: cleanFormatFlags,
                    length: 1,
                    link,
                };
                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    /**
     * Overwrite a range of this line with content from a source StyledLine.
     * More efficient than calling setChar() per character because it does
     * a single span split + rebuild instead of per-character span manipulation.
     * @param destinationStart — start index in this line
     * @param source — the StyledLine to copy from
     * @param srcStart — start index in source (default 0)
     * @param count — number of characters to copy (default: source.length)
     */
    writeFrom(destinationStart: number, source: StyledLine, srcStart = 0, count?: number): void {
        const n = count ?? source.length - srcStart;

        if (n <= 0 || destinationStart >= this.length) {
            return;
        }

        this._cachedTrimmedLength = undefined;
        this.ensureInitialized();

        const actualCount = Math.min(n, this.length - destinationStart, source.length - srcStart);

        // Rebuild text in the destination range
        const destinationTextStart = this.charData![destinationStart]! & OFFSET_MASK;
        const destinationTextEnd =
            destinationStart + actualCount < this.length ? this.charData![destinationStart + actualCount]! & OFFSET_MASK : this.text!.length;

        // Build new text segment from source
        let newSegment = "";

        for (let i = 0; i < actualCount; i++) {
            newSegment += source.getValue(srcStart + i);
        }

        const oldSegLength = destinationTextEnd - destinationTextStart;
        const diff = newSegment.length - oldSegLength;

        this.text = this.text!.slice(0, destinationTextStart) + newSegment + this.text!.slice(destinationTextEnd);

        // Update charData offsets
        let offset = destinationTextStart;

        for (let i = 0; i < actualCount; i++) {
            const srcFullWidth = source.getFullWidth(srcStart + i);

            this.charData![destinationStart + i] = offset | (srcFullWidth ? FULL_WIDTH_FLAG : 0);
            offset += source.getValue(srcStart + i).length;
        }

        // Shift subsequent offsets
        if (diff !== 0) {
            for (let i = destinationStart + actualCount; i < this.length; i++) {
                const data = this.charData![i]!;

                this.charData![i] = ((data & OFFSET_MASK) + diff) | (data & FULL_WIDTH_FLAG);
            }
        }

        // Replace spans in the range
        this.splitSpansAt(destinationStart);
        this.splitSpansAt(destinationStart + actualCount);

        // Build new spans from source for the range
        const newSpans: StyleSpan[] = [];
        let srcSpanStart = 0;

        for (const span of source.getSpans()) {
            const spanEnd = srcSpanStart + span.length;
            const overlapStart = Math.max(srcStart, srcSpanStart);
            const overlapEnd = Math.min(srcStart + actualCount, spanEnd);

            if (overlapStart < overlapEnd) {
                newSpans.push({ ...span, length: overlapEnd - overlapStart });
            }

            srcSpanStart = spanEnd;

            if (srcSpanStart >= srcStart + actualCount) {
                break;
            }
        }

        // Replace the affected span range
        let destinationSpanIndex = 0;
        let destinationSpanOffset = 0;

        for (let i = 0; i < this.spans!.length; i++) {
            if (destinationSpanOffset === destinationStart) {
                destinationSpanIndex = i;
                break;
            }

            destinationSpanOffset += this.spans![i]!.length;
        }

        // Find how many spans to remove (those covering destStart..destStart+actualCount)
        let removeCount = 0;
        let covered = 0;

        for (let i = destinationSpanIndex; i < this.spans!.length && covered < actualCount; i++) {
            covered += this.spans![i]!.length;
            removeCount++;
        }

        this.spans!.splice(destinationSpanIndex, removeCount, ...newSpans);
        this.mergeSpans();
    }

    pushChar(value: string, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): void {
        this._cachedTrimmedLength = undefined;
        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const offset = this.text!.length;

        this.text = (this.text ?? "") + value;

        this.charData!.push(offset | (isFullWidth ? FULL_WIDTH_FLAG : 0));

        const lastSpan = this.spans!.at(-1);

        if (lastSpan?.formatFlags === cleanFormatFlags && lastSpan.fgColor === fgColor && lastSpan.bgColor === bgColor && lastSpan.link === link) {
            lastSpan.length++;
        } else {
            this.spans!.push({
                bgColor,
                fgColor,
                formatFlags: cleanFormatFlags,
                length: 1,
                link,
            });
        }

        this.length++;
    }

    clone(): StyledLine {
        if (this.charData === undefined) {
            return new StyledLine();
        }

        const result = new StyledLine();

        result.length = this.length;
        result.text = this.text;
        result.charData = [...this.charData];
        result.spans = this.spans!.map((span) => {
            return {
                ...span,
            };
        });
        result._cachedTrimmedLength = this._cachedTrimmedLength;

        return result;
    }

    slice(start: number, end?: number): StyledLine {
        if (this.charData === undefined) {
            return new StyledLine();
        }

        const actualStart = Math.max(0, start);
        const actualEnd = end === undefined ? this.length : Math.min(this.length, end);

        if (actualStart >= actualEnd) {
            return new StyledLine();
        }

        if (actualStart === 0 && actualEnd === this.length) {
            return this.clone();
        }

        const result = new StyledLine();

        result.length = actualEnd - actualStart;
        result.charData = Array.from({ length: result.length });

        const textStart = this.charData[actualStart]! & OFFSET_MASK;
        const textEnd = actualEnd < this.length ? this.charData[actualEnd]! & OFFSET_MASK : this.text!.length;

        result.text = this.text!.slice(textStart, textEnd);

        for (let i = 0; i < result.length; i++) {
            const oldData = this.charData[actualStart + i]!;
            const oldOffset = oldData & OFFSET_MASK;
            const fw = oldData & FULL_WIDTH_FLAG;

            result.charData[i] = (oldOffset - textStart) | fw;
        }

        const newSpans: StyleSpan[] = [];
        let current = 0;

        for (const span of this.spans!) {
            const spanStart = current;
            const spanEnd = current + span.length;

            const intersectStart = Math.max(actualStart, spanStart);
            const intersectEnd = Math.min(actualEnd, spanEnd);

            if (intersectStart < intersectEnd) {
                newSpans.push({
                    ...span,
                    length: intersectEnd - intersectStart,
                });
            }

            current += span.length;

            if (current >= actualEnd) {
                break;
            }
        }

        result.spans = newSpans;
        result.mergeSpans();

        return result;
    }

    combine(...others: StyledLine[]): StyledLine {
        if (others.length === 0) {
            return this.clone();
        }

        const allLines = [this as StyledLine, ...others].filter((l) => l.length > 0);

        if (allLines.length === 0) {
            return new StyledLine();
        }

        if (allLines.length === 1) {
            return allLines[0]!.clone();
        }

        let totalChars = 0;

        for (const line of allLines) {
            totalChars += line.length;
        }

        const result = new StyledLine();

        result.length = totalChars;
        result.text = allLines.map((l) => l.getText()).join("");
        result.charData = Array.from({ length: totalChars });

        let currentChar = 0;
        let currentOffset = 0;

        for (const line of allLines) {
            const lineCharData = (line as unknown as { charData?: number[] }).charData;
            const lineText = line.getText();

            if (lineCharData) {
                for (let i = 0; i < line.length; i++) {
                    const data = lineCharData[i]!;
                    const lineOffset = data & OFFSET_MASK;
                    const fw = data & FULL_WIDTH_FLAG;

                    result.charData[currentChar + i] = (currentOffset + lineOffset) | fw;
                }
            } else {
                for (let i = 0; i < line.length; i++) {
                    result.charData[currentChar + i] = currentOffset + i;
                }
            }

            currentChar += line.length;
            currentOffset += lineText.length;
        }

        result.spans = allLines.flatMap((l) =>
            l.getSpans().map((s) => {
                return {
                    ...s,
                };
            }),
        );
        result.mergeSpans();

        return result;
    }

    getTrimmedLength(): number {
        if (this._cachedTrimmedLength !== undefined) {
            return this._cachedTrimmedLength;
        }

        if (this.length === 0) {
            this._cachedTrimmedLength = 0;

            return 0;
        }

        if (this.text === undefined || this.charData === undefined) {
            this._cachedTrimmedLength = 0;

            return 0;
        }

        let currentIndex = this.length - 1;

        if (this.spans) {
            for (let s = this.spans.length - 1; s >= 0; s--) {
                const span = this.spans[s]!;
                const hasStylesOnSpan =
                    (span.formatFlags & ~FULL_WIDTH_MASK) !== 0 || span.fgColor !== undefined || span.bgColor !== undefined || span.link !== undefined;

                if (hasStylesOnSpan) {
                    this._cachedTrimmedLength = currentIndex + 1;

                    return this._cachedTrimmedLength;
                }

                for (let i = 0; i < span.length; i++) {
                    const charStart = this.charData[currentIndex]! & OFFSET_MASK;
                    const charEnd = currentIndex + 1 < this.length ? this.charData[currentIndex + 1]! & OFFSET_MASK : this.text.length;

                    if (charEnd - charStart !== 1 || this.text[charStart] !== " ") {
                        this._cachedTrimmedLength = currentIndex + 1;

                        return this._cachedTrimmedLength;
                    }

                    currentIndex--;
                }
            }
        }

        this._cachedTrimmedLength = 0;

        return 0;
    }

    trimEnd(): StyledLine {
        const trimmedLength = this.getTrimmedLength();

        if (trimmedLength === this.length) {
            return this;
        }

        if (trimmedLength === 0) {
            return new StyledLine();
        }

        return this.slice(0, trimmedLength);
    }

    equals(other: StyledLine): boolean {
        if (this.length !== other.length) {
            return false;
        }

        if (this.length === 0) {
            return true;
        }

        if (this.getText() !== other.getText()) {
            return false;
        }

        const s1 = this.getSpans();
        const s2 = other.getSpans();

        if (s1.length !== s2.length) {
            return false;
        }

        for (const [i, element] of s1.entries()) {
            const sp1 = element;
            const sp2 = s2[i]!;

            if (
                sp1.length !== sp2.length ||
                sp1.formatFlags !== sp2.formatFlags ||
                sp1.fgColor !== sp2.fgColor ||
                sp1.bgColor !== sp2.bgColor ||
                sp1.link !== sp2.link
            ) {
                return false;
            }
        }

        const thisCharData = this.charData;
        const otherCharData = (other as unknown as { charData?: number[] }).charData;

        if (thisCharData && otherCharData) {
            for (let i = 0; i < this.length; i++) {
                if (thisCharData[i] !== otherCharData[i]) {
                    return false;
                }
            }
        }

        return true;
    }

    getText(): string {
        return this.text ?? "";
    }

    getSpans(): StyleSpan[] {
        return this.spans ?? [];
    }

    getValues(): string[] {
        return Array.from({ length: this.length }, (_, i) => this.getValue(i));
    }

    *[Symbol.iterator](): Iterator<{
        bgColor?: string;
        fgColor?: string;
        formatFlags: number;
        fullWidth: boolean;
        hasStyles: boolean;
        link?: string;
        value: string;
    }> {
        if (this.length === 0) {
            return;
        }

        let currentSpanIndex = 0;
        let currentSpanPos = 0;
        const spans = this.getSpans();

        for (let i = 0; i < this.length; i++) {
            const span = spans[currentSpanIndex];
            const flags = span ? span.formatFlags : 0;
            const isFullWidth = this.getFullWidth(i);

            yield {
                bgColor: span?.bgColor,
                fgColor: span?.fgColor,
                formatFlags: flags | (isFullWidth ? FULL_WIDTH_MASK : 0),
                fullWidth: isFullWidth,
                hasStyles: (flags & ~FULL_WIDTH_MASK) !== 0 || span?.fgColor !== undefined || span?.bgColor !== undefined || span?.link !== undefined,
                link: span?.link,
                value: this.getValue(i),
            };

            if (span) {
                currentSpanPos++;

                if (currentSpanPos >= span.length) {
                    currentSpanIndex++;
                    currentSpanPos = 0;
                }
            }
        }
    }

    /**
     * Split the span at `index` into a single-char span, apply the updater,
     * then merge adjacent spans. Shared by setInverted/setBackgroundColor/setForegroundColor.
     */
    private updateSpanAt(index: number, updater: (span: StyleSpan) => void): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this.ensureInitialized();
        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (const span of this.spans!) {
            if (current === index && span.length === 1) {
                updater(span);
                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    /**
     * Grow the line to at least `minWidth` columns, filling new cells with
     * empty strings (zero-width placeholders). This matches the behavior of
     * sparse JS arrays in the original ink Output where out-of-bounds writes
     * created gaps that produced no visible output.
     */
    ensureWidth(minWidth: number): void {
        if (minWidth <= this.length) {
            return;
        }

        this.ensureInitialized();

        const oldLength = this.length;
        const extraCount = minWidth - oldLength;
        const oldTextLength = this.text!.length;

        // All new cells point to the same offset (end of text) — zero-length values
        for (let i = 0; i < extraCount; i++) {
            this.charData!.push(oldTextLength);
        }

        this.length = minWidth;

        // Extend the last span or add a new default span
        const lastSpan = this.spans!.at(-1);

        if (lastSpan?.formatFlags === 0 && lastSpan.fgColor === undefined && lastSpan.bgColor === undefined && lastSpan.link === undefined) {
            lastSpan.length += extraCount;
        } else {
            this.spans!.push({ formatFlags: 0, length: extraCount });
        }
    }

    private ensureInitialized(): void {
        if (this.charData === undefined) {
            this.text = "";
            this.charData = Array.from({ length: this.length });
            this.spans = this.length > 0 ? [{ formatFlags: 0, length: this.length }] : [];

            if (this.length > 0 && this.text.length === 0) {
                this.text = " ".repeat(this.length);

                for (let i = 0; i < this.length; i++) {
                    this.charData[i] = i;
                }
            }
        }
    }

    private splitSpansAt(index: number): void {
        if (this.spans === undefined || index <= 0 || index >= this.length) {
            return;
        }

        let current = 0;

        for (let i = 0; i < this.spans.length; i++) {
            const span = this.spans[i]!;

            if (index > current && index < current + span.length) {
                const leftLength = index - current;
                const rightLength = span.length - leftLength;

                this.spans.splice(i, 1, { ...span, length: leftLength }, { ...span, length: rightLength });

                return;
            }

            current += span.length;
        }
    }

    /**
     * Try to apply a single-char style at `index` by matching or merging
     * with an adjacent span, avoiding splitSpansAt + mergeSpans.
     *
     * Returns true if the style was applied (or was already correct),
     * false if the caller must fall through to the split/update/merge path.
     *
     * Ported from jacob314/ink PR #123 (Google LLC, Apache-2.0).
     */
    private trySetStyleAtIndex(index: number, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): boolean {
        if (!this.spans) {
            return false;
        }

        let currentOffset = 0;
        let spanIndex = -1;
        let span: StyleSpan | undefined;

        for (let i = 0; i < this.spans.length; i++) {
            const s = this.spans[i]!;

            if (currentOffset <= index && currentOffset + s.length > index) {
                spanIndex = i;
                span = s;
                break;
            }

            currentOffset += s.length;
        }

        if (!span) {
            return false;
        }

        if (span.formatFlags === formatFlags && span.fgColor === fgColor && span.bgColor === bgColor && span.link === link) {
            return true;
        }

        if (index === currentOffset && spanIndex > 0) {
            const previousSpan = this.spans[spanIndex - 1]!;

            if (
                previousSpan.formatFlags === formatFlags &&
                previousSpan.fgColor === fgColor &&
                previousSpan.bgColor === bgColor &&
                previousSpan.link === link
            ) {
                previousSpan.length += 1;

                if (span.length === 1) {
                    this.spans.splice(spanIndex, 1);
                } else {
                    span.length -= 1;
                }

                return true;
            }
        }

        if (index === currentOffset + span.length - 1 && spanIndex < this.spans.length - 1) {
            const nextSpan = this.spans[spanIndex + 1]!;

            if (nextSpan.formatFlags === formatFlags && nextSpan.fgColor === fgColor && nextSpan.bgColor === bgColor && nextSpan.link === link) {
                nextSpan.length += 1;

                if (span.length === 1) {
                    this.spans.splice(spanIndex, 1);
                } else {
                    span.length -= 1;
                }

                return true;
            }
        }

        return false;
    }

    private mergeSpans(): void {
        if (this.spans === undefined) {
            return;
        }

        const newSpans: StyleSpan[] = [];

        for (const span of this.spans) {
            if (span.length === 0) {
                continue;
            }

            const last = newSpans.at(-1);

            if (last?.formatFlags === span.formatFlags && last.fgColor === span.fgColor && last.bgColor === span.bgColor && last.link === span.link) {
                last.length += span.length;
            } else {
                newSpans.push({ ...span });
            }
        }

        this.spans = newSpans;
    }
}
