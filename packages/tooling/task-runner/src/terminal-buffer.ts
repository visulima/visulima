/**
 * Minimal virtual terminal buffer that processes ANSI escape sequences
 * for cursor movement and line erasure. This allows PTY output from
 * interactive tools (inquirer, etc.) to render correctly by updating
 * lines in place rather than always appending.
 *
 * Supported sequences:
 * - \r       carriage return (cursor to column 0)
 * - \n       line feed (new line)
 * - \x1b[nA  cursor up n lines
 * - \x1b[nB  cursor down n lines
 * - \x1b[nC  cursor forward n columns
 * - \x1b[nD  cursor back n columns
 * - \x1b[nG  cursor to column n
 * - \x1b[r;cH cursor position
 * - \x1b[K   erase from cursor to end of line (0K, 1K, 2K)
 * - \x1b[J   erase from cursor to end of display (0J, 1J, 2J)
 * - \x1b[...m SGR (colors/styles) — passed through into output
 */

export class TerminalBuffer {
    #lines: string[] = [""];

    #row = 0;

    #col = 0;

    readonly #maxBytes: number;

    public constructor(maxBytes: number = 256 * 1024) {
        this.#maxBytes = maxBytes;
    }

    /**
     * Process raw PTY output data.
     */
    public write(data: string): void {
        let i = 0;

        while (i < data.length) {
            const ch = data[i]!;

            // ESC sequence
            if (ch === "\u001B") {
                if (i + 1 >= data.length) {
                    // Lone ESC at end of data — skip
                    i++;

                    continue;
                }

                if (data[i + 1] === "[") {
                    // CSI sequence: ESC [ <params> <command>
                    const consumed = this.#processCsi(data, i + 2);

                    i = consumed;

                    continue;
                }

                // Non-CSI escape sequences:
                // ESC( and ESC) are 3-byte (ESC, paren, charset letter)
                // Others like ESC>, ESC= are 2-byte
                i += data[i + 1] === "(" || data[i + 1] === ")" ? 3 : 2;

                continue;
            }

            // Carriage return
            if (ch === "\r") {
                this.#col = 0;
                i++;

                continue;
            }

            // Line feed
            if (ch === "\n") {
                this.#row++;
                this.#col = 0;
                this.#ensureRow(this.#row);
                i++;

                continue;
            }

            // Regular printable run — overwrite at cursor position.
            //
            // Batch the whole contiguous printable run (up to the next ESC,
            // CR, or LF) and write it in a single line walk. Calling
            // `#putChar` per character re-walks the line from index 0 for
            // every glyph, which is O(line^2) for long lines (progress bars,
            // webpack stats). One walk per run keeps it linear.
            let runEnd = i;

            while (runEnd < data.length) {
                const c = data[runEnd]!;

                if (c === "\u001B" || c === "\r" || c === "\n") {
                    break;
                }

                runEnd++;
            }

            this.#ensureRow(this.#row);
            this.#putString(data.slice(i, runEnd));
            i = runEnd;
        }

        this.#trimToMaxBytes();
    }

    /** Get the current buffer content as a string. */
    public toString(): string {
        return this.#lines.join("\n");
    }

    /**
     * Process a CSI sequence starting after "ESC [".
     * Returns the index to continue parsing from.
     */
    #processCsi(data: string, start: number): number {
        let j = start;
        let params = "";

        // Collect parameter bytes (digits and semicolons)
        while (j < data.length && ((data[j]! >= "0" && data[j]! <= "9") || data[j] === ";")) {
            params += data[j] ?? "";
            j++;
        }

        // Command byte
        if (j >= data.length) {
            return j;
        }

        const cmd = data[j]!;
        const n = Number.parseInt(params, 10) || 1;

        switch (cmd) {
            case "A": {
                // cursor up
                this.#row = Math.max(0, this.#row - n);
                break;
            }
            case "B": {
                // cursor down
                this.#row = Math.min(this.#lines.length - 1, this.#row + n);
                break;
            }
            case "C": {
                // cursor forward
                this.#col += n;
                break;
            }
            case "D": {
                // cursor back
                this.#col = Math.max(0, this.#col - n);
                break;
            }
            case "f":
            case "H": {
                // cursor position (row;col, 1-based)
                const parts = params.split(";");

                this.#row = Math.max(0, (Number.parseInt(parts[0] ?? "1", 10) || 1) - 1);
                this.#col = Math.max(0, (Number.parseInt(parts[1] ?? "1", 10) || 1) - 1);
                this.#ensureRow(this.#row);
                break;
            }
            case "G": {
                // cursor to column (1-based)
                this.#col = Math.max(0, n - 1);
                break;
            }
            case "J": {
                this.#eraseDisplay(Number.parseInt(params, 10) || 0);
                break;
            }
            case "K": {
                this.#eraseLine(Number.parseInt(params, 10) || 0);
                break;
            }
            case "m": {
                // SGR (styling) — append the full sequence into the current line.
                // SGR codes are zero-width; we insert them at the current write position.
                const seq = `\u001B[${params}m`;

                this.#ensureRow(this.#row);
                this.#appendAtCursor(seq);
                break;
            }
            default: {
                // Unknown CSI command — skip
                break;
            }
        }

        return j + 1;
    }

    /**
     * Write a run of visible characters at the cursor position (overwrites),
     * advancing the cursor. Walks the existing line at most twice for the
     * whole run instead of once per character, keeping `write()` linear in
     * the input length rather than quadratic in line length.
     *
     * Semantics are identical to writing the characters one-by-one: each
     * visible glyph overwrites the glyph currently at its visual column, and
     * gaps past the visible end are padded with spaces.
     */
    #putString(run: string): void {
        if (run.length === 0) {
            return;
        }

        const line = this.#lines[this.#row] ?? "";
        const startCol = this.#col;
        // Walk the existing line once to find the string index of the cursor
        // column, skipping embedded ANSI escape sequences.
        let strIndex = 0;
        let vis = 0;

        while (strIndex < line.length && vis < startCol) {
            if (line[strIndex] === "\u001B" && line[strIndex + 1] === "[") {
                strIndex += 2;

                while (strIndex < line.length && !((line[strIndex]! >= "A" && line[strIndex]! <= "Z") || (line[strIndex]! >= "a" && line[strIndex]! <= "z"))) {
                    strIndex++;
                }

                if (strIndex < line.length) {
                    strIndex++; // skip command letter
                }
            } else {
                strIndex++;
                vis++;
            }
        }

        // Pad with spaces if the cursor sits past the visible end.
        if (vis < startCol) {
            this.#lines[this.#row] = line + " ".repeat(startCol - vis) + run;
            this.#col = startCol + run.length;

            return;
        }

        // Continue walking from the cursor to consume `run.length` visible
        // glyphs to overwrite, this time PRESERVING any embedded escape
        // sequences interleaved between the overwritten glyphs (e.g. an
        // `\u001B[31m` sitting between two characters must survive). We build the
        // overwritten span by emitting one run-character per visible glyph and
        // copying escape sequences through verbatim -- identical to writing the
        // run one character at a time, but in a single pass.
        let endIndex = strIndex;
        let overwritten = 0;
        let rebuilt = "";

        while (endIndex < line.length && overwritten < run.length) {
            if (line[endIndex] === "\u001B" && line[endIndex + 1] === "[") {
                const seqStart = endIndex;

                endIndex += 2;

                while (endIndex < line.length && !((line[endIndex]! >= "A" && line[endIndex]! <= "Z") || (line[endIndex]! >= "a" && line[endIndex]! <= "z"))) {
                    endIndex++;
                }

                if (endIndex < line.length) {
                    endIndex++; // include command letter
                }

                // Copy the escape sequence through unchanged.
                rebuilt += line.slice(seqStart, endIndex);
            } else {
                // Overwrite one visible glyph with the next run character.
                rebuilt += run[overwritten]!;
                endIndex++;
                overwritten++;
            }
        }

        // Any run characters that ran past the existing line's visible glyphs
        // are appended (the line was shorter than the run).
        if (overwritten < run.length) {
            rebuilt += run.slice(overwritten);
        }

        this.#lines[this.#row] = line.slice(0, strIndex) + rebuilt + line.slice(endIndex);
        this.#col = startCol + run.length;
    }

    /** Append a zero-width sequence (SGR) at the current cursor position. */
    #appendAtCursor(seq: string): void {
        const line = this.#lines[this.#row] ?? "";
        // Find string index for the visual cursor position
        let strIndex = 0;
        let vis = 0;

        while (strIndex < line.length && vis < this.#col) {
            if (line[strIndex] === "\u001B" && line[strIndex + 1] === "[") {
                strIndex += 2;

                while (strIndex < line.length && !((line[strIndex]! >= "A" && line[strIndex]! <= "Z") || (line[strIndex]! >= "a" && line[strIndex]! <= "z"))) {
                    strIndex++;
                }

                if (strIndex < line.length) {
                    strIndex++;
                }
            } else {
                strIndex++;
                vis++;
            }
        }

        this.#lines[this.#row] = line.slice(0, strIndex) + seq + line.slice(strIndex);
    }

    #eraseDisplay(mode: number): void {
        switch (mode) {
            case 0: {
                // Erase from cursor to end — truncate current line at visual col, remove lines below
                this.#ensureRow(this.#row);
                this.#truncateLineAtCol(this.#row, this.#col);
                this.#lines.length = this.#row + 1;

                break;
            }
            case 1: {
                // Erase from start to cursor
                for (let r = 0; r < this.#row; r++) {
                    this.#lines[r] = "";
                }

                this.#ensureRow(this.#row);
                this.#fillLineToCol(this.#row, this.#col);

                break;
            }
            case 2: {
                this.#lines = [""];
                this.#row = 0;
                this.#col = 0;

                break;
            }
            default: {
                break;
            }
        }
    }

    #eraseLine(mode: number): void {
        this.#ensureRow(this.#row);

        switch (mode) {
            case 0: {
                this.#truncateLineAtCol(this.#row, this.#col);

                break;
            }
            case 1: {
                this.#fillLineToCol(this.#row, this.#col);

                break;
            }
            case 2: {
                this.#lines[this.#row] = "";

                break;
            }
            default: {
                break;
            }
        }
    }

    /** Truncate a line at the given visual column. */
    #truncateLineAtCol(row: number, col: number): void {
        const line = this.#lines[row] ?? "";
        let strIndex = 0;
        let vis = 0;

        while (strIndex < line.length && vis < col) {
            if (line[strIndex] === "\u001B" && line[strIndex + 1] === "[") {
                strIndex += 2;

                while (strIndex < line.length && !((line[strIndex]! >= "A" && line[strIndex]! <= "Z") || (line[strIndex]! >= "a" && line[strIndex]! <= "z"))) {
                    strIndex++;
                }

                if (strIndex < line.length) {
                    strIndex++;
                }
            } else {
                strIndex++;
                vis++;
            }
        }

        this.#lines[row] = line.slice(0, strIndex);
    }

    /** Fill a line with spaces from start to the given visual column. */
    #fillLineToCol(row: number, col: number): void {
        const line = this.#lines[row] ?? "";
        let strIndex = 0;
        let vis = 0;

        while (strIndex < line.length && vis < col) {
            if (line[strIndex] === "\u001B" && line[strIndex + 1] === "[") {
                strIndex += 2;

                while (strIndex < line.length && !((line[strIndex]! >= "A" && line[strIndex]! <= "Z") || (line[strIndex]! >= "a" && line[strIndex]! <= "z"))) {
                    strIndex++;
                }

                if (strIndex < line.length) {
                    strIndex++;
                }
            } else {
                strIndex++;
                vis++;
            }
        }

        this.#lines[row] = " ".repeat(col) + line.slice(strIndex);
    }

    #ensureRow(row: number): void {
        while (this.#lines.length <= row) {
            this.#lines.push("");
        }
    }

    #trimToMaxBytes(): void {
        let totalSize = 0;

        for (const line of this.#lines) {
            totalSize += line.length + 1;
        }

        while (totalSize > this.#maxBytes && this.#lines.length > 1) {
            const removed = this.#lines.shift()!;

            totalSize -= removed.length + 1;
            this.#row = Math.max(0, this.#row - 1);
        }
    }
}
