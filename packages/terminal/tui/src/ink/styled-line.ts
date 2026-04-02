/**
 * Columnar data structure for a single line of styled terminal text.
 *
 * Instead of one heap-allocated object per visible character (the StyledChar
 * model from @alcalzone/ansi-tokenize), StyledLine stores:
 *
 * - `text: string` — concatenated raw character values
 * - `charData: Uint16Array` — per-character: 15-bit offset into text | 1-bit full-width flag
 * - `spans: StyleSpan[]` — run-length encoded style information
 *
 * For an 80-column line this reduces allocations from ~80 objects to
 * 1 string + 1 typed array + typically 1-5 span objects.
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 *
 * @license Apache-2.0
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-bitwise, no-plusplus */

import { FULL_WIDTH_MASK, INVERSE_MASK } from "./style-flags";

export type StyleSpan = {
    bgColor?: string;
    fgColor?: string;
    formatFlags: number;
    length: number;
    link?: string;
};

const MAX_SAFE_OFFSET = 0x7f_ff; // 32767

export class StyledLine {
    public length: number;

    private static readonly emptyCache = new Map<number, StyledLine>();

    private text: string | undefined;

    private charData: Uint16Array | undefined;

    private spans: StyleSpan[] | undefined;

    constructor() {
        this.length = 0;
    }

    static empty(length: number): StyledLine {
        const safeLength = Math.min(length, MAX_SAFE_OFFSET);

        if (safeLength <= 0) {
            return new StyledLine();
        }

        const cached = StyledLine.emptyCache.get(safeLength);

        if (cached) {
            return cached.clone();
        }

        const line = new StyledLine();

        line.length = safeLength;
        line.text = " ".repeat(safeLength);
        line.charData = new Uint16Array(Math.max(safeLength, 16));

        for (let i = 0; i < safeLength; i++) {
            line.charData[i] = i;
        }

        line.spans = [{ formatFlags: 0, length: safeLength }];

        if (StyledLine.emptyCache.size > 100) {
            StyledLine.emptyCache.clear();
        }

        Object.freeze(line.spans[0]);
        Object.freeze(line.spans);
        Object.freeze(line);

        StyledLine.emptyCache.set(safeLength, line);

        return line.clone();
    }

    getValue(index: number): string {
        if (this.text === undefined || index < 0 || index >= this.length) {
            return "";
        }

        const start = this.charData![index]! & 0x7f_ff;
        const end = index + 1 < this.length ? this.charData![index + 1]! & 0x7f_ff : this.text.length;

        return this.text.slice(start, end);
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

        return (this.charData[index]! & 0x80_00) !== 0;
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
        if (index < 0 || index >= this.length) {
            return;
        }

        this.ensureInitialized();
        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (const span of this.spans!) {
            if (current === index && span.length === 1) {
                if (inverted) {
                    span.formatFlags |= INVERSE_MASK;
                } else {
                    span.formatFlags &= ~INVERSE_MASK;
                }

                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    setBackgroundColor(index: number, color: string | undefined): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this.ensureInitialized();
        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (const span of this.spans!) {
            if (current === index && span.length === 1) {
                span.bgColor = color;
                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    setForegroundColor(index: number, color: string | undefined): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this.ensureInitialized();
        this.splitSpansAt(index);
        this.splitSpansAt(index + 1);

        let current = 0;

        for (const span of this.spans!) {
            if (current === index && span.length === 1) {
                span.fgColor = color;
                break;
            }

            current += span.length;
        }

        this.mergeSpans();
    }

    setChar(index: number, value: string, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): void {
        if (index < 0 || index >= this.length) {
            return;
        }

        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const start = this.charData![index]! & 0x7f_ff;
        const end = index + 1 < this.length ? this.charData![index + 1]! & 0x7f_ff : this.text!.length;
        const oldLen = end - start;

        let newValue = value;

        if (this.text!.length - oldLen + value.length > MAX_SAFE_OFFSET) {
            newValue = value.slice(0, Math.max(0, MAX_SAFE_OFFSET - (this.text!.length - oldLen)));
        }

        const newLen = newValue.length;

        this.text = this.text!.slice(0, start) + newValue + this.text!.slice(end);

        if (oldLen !== newLen) {
            const diff = newLen - oldLen;

            for (let i = index + 1; i < this.length; i++) {
                const data = this.charData![i]!;
                const oldOffset = data & 0x7f_ff;
                const fw = data & 0x80_00;

                this.charData![i] = (oldOffset + diff) | fw;
            }
        }

        this.charData![index] = start | (isFullWidth ? 0x80_00 : 0);

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

        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const start = this.charData![index]! & 0x7f_ff;
        const end = index + 1 < this.length ? this.charData![index + 1]! & 0x7f_ff : this.text!.length;
        const oldLen = end - start;

        // Fast path: same-length replacement (no offset adjustment needed)
        if (value.length === oldLen) {
            // Replace the character in the text string
            if (value !== this.text!.slice(start, end)) {
                this.text = this.text!.slice(0, start) + value + this.text!.slice(end);
            }

            this.charData![index] = start | (isFullWidth ? 0x80_00 : 0);
        } else {
            // Slow path: different length, need offset adjustment
            this.text = this.text!.slice(0, start) + value + this.text!.slice(end);

            if (oldLen !== value.length) {
                const diff = value.length - oldLen;

                for (let i = index + 1; i < this.length; i++) {
                    const data = this.charData![i]!;

                    this.charData![i] = ((data & 0x7f_ff) + diff) | (data & 0x80_00);
                }
            }

            this.charData![index] = start | (isFullWidth ? 0x80_00 : 0);
        }

        // Check if the style at this index already matches — if so, skip
        // the expensive splitSpansAt + mergeSpans work entirely.
        const existingSpan = this.getSpan(index);

        if (existingSpan && existingSpan.formatFlags === cleanFormatFlags && existingSpan.fgColor === fgColor && existingSpan.bgColor === bgColor && existingSpan.link === link) {
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
     *
     * @param destStart — start index in this line
     * @param source — the StyledLine to copy from
     * @param srcStart — start index in source (default 0)
     * @param count — number of characters to copy (default: source.length)
     */
    writeFrom(destStart: number, source: StyledLine, srcStart = 0, count?: number): void {
        const n = count ?? source.length - srcStart;

        if (n <= 0 || destStart >= this.length) {
            return;
        }

        this.ensureInitialized();

        const actualCount = Math.min(n, this.length - destStart, source.length - srcStart);

        // Rebuild text in the destination range
        const destTextStart = this.charData![destStart]! & 0x7f_ff;
        const destTextEnd = destStart + actualCount < this.length ? this.charData![destStart + actualCount]! & 0x7f_ff : this.text!.length;

        // Build new text segment from source
        let newSegment = "";

        for (let i = 0; i < actualCount; i++) {
            newSegment += source.getValue(srcStart + i);
        }

        const oldSegLen = destTextEnd - destTextStart;
        const diff = newSegment.length - oldSegLen;

        this.text = this.text!.slice(0, destTextStart) + newSegment + this.text!.slice(destTextEnd);

        // Update charData offsets
        let offset = destTextStart;

        for (let i = 0; i < actualCount; i++) {
            const srcFullWidth = source.getFullWidth(srcStart + i);

            this.charData![destStart + i] = offset | (srcFullWidth ? 0x80_00 : 0);
            offset += source.getValue(srcStart + i).length;
        }

        // Shift subsequent offsets
        if (diff !== 0) {
            for (let i = destStart + actualCount; i < this.length; i++) {
                const data = this.charData![i]!;

                this.charData![i] = ((data & 0x7f_ff) + diff) | (data & 0x80_00);
            }
        }

        // Replace spans in the range
        this.splitSpansAt(destStart);
        this.splitSpansAt(destStart + actualCount);

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
        let destSpanIdx = 0;
        let destSpanOffset = 0;

        for (let i = 0; i < this.spans!.length; i++) {
            if (destSpanOffset === destStart) {
                destSpanIdx = i;
                break;
            }

            destSpanOffset += this.spans![i]!.length;
        }

        // Find how many spans to remove (those covering destStart..destStart+actualCount)
        let removeCount = 0;
        let covered = 0;

        for (let i = destSpanIdx; i < this.spans!.length && covered < actualCount; i++) {
            covered += this.spans![i]!.length;
            removeCount++;
        }

        this.spans!.splice(destSpanIdx, removeCount, ...newSpans);
        this.mergeSpans();
    }

    pushChar(value: string, formatFlags: number, fgColor?: string, bgColor?: string, link?: string): void {
        this.ensureInitialized();

        const isFullWidth = (formatFlags & FULL_WIDTH_MASK) !== 0;
        const cleanFormatFlags = formatFlags & ~FULL_WIDTH_MASK;

        const offset = this.text!.length;

        if (value !== "\u2026" && offset + value.length > MAX_SAFE_OFFSET - 1) {
            if (offset < MAX_SAFE_OFFSET && !this.text!.endsWith("\u2026")) {
                this.pushChar("\u2026", formatFlags, fgColor, bgColor, link);
            }

            return;
        }

        if (offset + value.length > MAX_SAFE_OFFSET) {
            return;
        }

        this.text += value;

        if (this.length >= this.charData!.length) {
            const newData = new Uint16Array(this.charData!.length * 2 || 16);

            newData.set(this.charData!);
            this.charData = newData;
        }

        this.charData![this.length] = offset | (isFullWidth ? 0x80_00 : 0);

        const lastSpan = this.spans!.at(-1);

        if (lastSpan && lastSpan.formatFlags === cleanFormatFlags && lastSpan.fgColor === fgColor && lastSpan.bgColor === bgColor && lastSpan.link === link) {
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
        result.charData = this.charData.slice(0, Math.max(this.length, 16));
        result.spans = this.spans!.map((span) => ({ ...span }));

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
        result.charData = new Uint16Array(Math.max(result.length, 16));

        const textStart = this.charData[actualStart]! & 0x7f_ff;
        const textEnd = actualEnd < this.length ? this.charData[actualEnd]! & 0x7f_ff : this.text!.length;

        result.text = this.text!.slice(textStart, textEnd);

        for (let i = 0; i < result.length; i++) {
            const oldData = this.charData[actualStart + i]!;
            const oldOffset = oldData & 0x7f_ff;
            const fw = oldData & 0x80_00;

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

        let totalTextLen = 0;
        let totalChars = 0;

        for (const line of allLines) {
            totalTextLen += line.getText().length;
            totalChars += line.length;
        }

        if (totalTextLen > MAX_SAFE_OFFSET) {
            let result: StyledLine = this.clone();

            for (const other of others) {
                result = result.instanceConcat(other);
            }

            return result;
        }

        const result = new StyledLine();

        result.length = totalChars;
        result.text = allLines.map((l) => l.getText()).join("");
        result.charData = new Uint16Array(Math.max(totalChars, 16));

        let currentChar = 0;
        let currentOffset = 0;

        for (const line of allLines) {
            const lineCharData = (line as { charData?: Uint16Array }).charData;
            const lineText = line.getText();

            if (lineCharData) {
                for (let i = 0; i < line.length; i++) {
                    const data = lineCharData[i]!;
                    const lineOffset = data & 0x7f_ff;
                    const fw = data & 0x80_00;

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

        result.spans = allLines.flatMap((l) => l.getSpans().map((s) => ({ ...s })));
        result.mergeSpans();

        return result;
    }

    getTrimmedLength(): number {
        if (this.length === 0) {
            return 0;
        }

        if (this.text === undefined || this.charData === undefined) {
            return 0;
        }

        let currentIdx = this.length - 1;

        if (this.spans) {
            for (let s = this.spans.length - 1; s >= 0; s--) {
                const span = this.spans[s]!;
                const hasStylesOnSpan =
                    (span.formatFlags & ~FULL_WIDTH_MASK) !== 0 ||
                    span.fgColor !== undefined ||
                    span.bgColor !== undefined ||
                    span.link !== undefined;

                if (hasStylesOnSpan) {
                    return currentIdx + 1;
                }

                for (let i = 0; i < span.length; i++) {
                    const charStart = this.charData[currentIdx]! & 0x7f_ff;
                    const charEnd = currentIdx + 1 < this.length ? this.charData[currentIdx + 1]! & 0x7f_ff : this.text.length;

                    if (charEnd - charStart !== 1 || this.text[charStart] !== " ") {
                        return currentIdx + 1;
                    }

                    currentIdx--;
                }
            }
        }

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

        for (let i = 0; i < s1.length; i++) {
            const sp1 = s1[i]!;
            const sp2 = s2[i]!;

            if (sp1.length !== sp2.length || sp1.formatFlags !== sp2.formatFlags || sp1.fgColor !== sp2.fgColor || sp1.bgColor !== sp2.bgColor || sp1.link !== sp2.link) {
                return false;
            }
        }

        const thisCharData = this.charData;
        const otherCharData = (other as { charData?: Uint16Array }).charData;

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

        let currentSpanIdx = 0;
        let currentSpanPos = 0;
        const spans = this.getSpans();

        for (let i = 0; i < this.length; i++) {
            const span = spans[currentSpanIdx];
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
                    currentSpanIdx++;
                    currentSpanPos = 0;
                }
            }
        }
    }

    private ensureInitialized(initialCapacity = 16): void {
        if (this.charData === undefined) {
            this.text = "";
            this.charData = new Uint16Array(Math.max(this.length, initialCapacity));
            this.spans = this.length > 0 ? [{ formatFlags: 0, length: this.length }] : [];

            if (this.length > 0 && this.text.length === 0) {
                this.text = " ".repeat(this.length);

                for (let i = 0; i < this.length; i++) {
                    this.charData[i] = i;
                }
            }
        }
    }

    private instanceConcat(other: StyledLine): StyledLine {
        const spaceForOther = MAX_SAFE_OFFSET - 1 - this.getText().length;

        if (spaceForOther <= 0) {
            if (this.getText().length < MAX_SAFE_OFFSET && !this.getText().endsWith("...")) {
                const result = this.clone();

                result.pushChar("...", 0);

                return result;
            }

            return this.clone();
        }

        let otherTextLenToTake = 0;
        let otherCharsToTake = 0;

        for (let i = 0; i < other.length; i++) {
            const val = other.getValue(i);

            if (otherTextLenToTake + val.length > spaceForOther) {
                break;
            }

            otherTextLenToTake += val.length;
            otherCharsToTake++;
        }

        const truncated = otherCharsToTake < other.length;
        const result = new StyledLine();

        result.length = this.length + otherCharsToTake + (truncated ? 1 : 0);
        result.text = this.getText() + other.getText().slice(0, otherTextLenToTake) + (truncated ? "..." : "");
        result.charData = new Uint16Array(Math.max(result.length, 16));

        if (this.charData) {
            result.charData.set(this.charData.subarray(0, this.length), 0);
        }

        const textOffset = this.getText().length;
        const otherCharData = (other as { charData?: Uint16Array }).charData;

        if (otherCharData) {
            for (let i = 0; i < otherCharsToTake; i++) {
                const oldData = otherCharData[i]!;
                const oldOffset = oldData & 0x7f_ff;
                const fw = oldData & 0x80_00;

                result.charData[this.length + i] = (oldOffset + textOffset) | fw;
            }
        }

        if (truncated) {
            result.charData[this.length + otherCharsToTake] = this.getText().length + otherTextLenToTake;
        }

        const otherSpans: StyleSpan[] = [];
        let remaining = otherCharsToTake;

        for (const span of other.getSpans()) {
            if (remaining <= 0) {
                break;
            }

            const take = Math.min(remaining, span.length);

            otherSpans.push({ ...span, length: take });
            remaining -= take;
        }

        result.spans = [...this.getSpans(), ...otherSpans];

        if (truncated) {
            result.spans.push({ formatFlags: 0, length: 1 });
        }

        result.mergeSpans();

        return result;
    }

    private splitSpansAt(index: number): void {
        if (this.spans === undefined || index <= 0 || index >= this.length) {
            return;
        }

        let current = 0;

        for (let i = 0; i < this.spans.length; i++) {
            const span = this.spans[i]!;

            if (index > current && index < current + span.length) {
                const leftLen = index - current;
                const rightLen = span.length - leftLen;

                this.spans.splice(i, 1, { ...span, length: leftLen }, { ...span, length: rightLen });

                return;
            }

            current += span.length;
        }
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

            if (last && last.formatFlags === span.formatFlags && last.fgColor === span.fgColor && last.bgColor === span.bgColor && last.link === span.link) {
                last.length += span.length;
            } else {
                newSpans.push({ ...span });
            }
        }

        this.spans = newSpans;
    }
}
