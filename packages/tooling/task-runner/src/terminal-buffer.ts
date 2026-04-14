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

    constructor(maxBytes: number = 256 * 1024) {
        this.#maxBytes = maxBytes;
    }

    /**
     * Process raw PTY output data.
     */
    write(data: string): void {
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

            // Regular printable character — overwrite at cursor position
            this.#ensureRow(this.#row);
            this.#putChar(ch);
            this.#col++;
            i++;
        }

        this.#trimToMaxBytes();
    }

    /** Get the current buffer content as a string. */
    toString(): string {
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
            params += data[j];
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

    /** Write a visible character at the cursor position (overwrites). */
    #putChar(ch: string): void {
        const line = this.#lines[this.#row] ?? "";
        const visCol = this.#col;
        // Walk the string tracking visible column to find the insert index,
        // skipping over any embedded ANSI escape sequences.
        let strIndex = 0;
        let vis = 0;

        while (strIndex < line.length && vis < visCol) {
            if (line[strIndex] === "\u001B" && line[strIndex + 1] === "[") {
                // Skip past CSI sequence
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

        // Pad with spaces if cursor is past the visible end
        if (vis < visCol) {
            this.#lines[this.#row] = line + " ".repeat(visCol - vis) + ch;
        } else {
            // Find the end of the character to overwrite (skip its ANSI sequences too)
            let endIndex = strIndex;

            if (endIndex < line.length && line[endIndex] !== "\u001B") {
                endIndex++; // skip one visible character
            }

            this.#lines[this.#row] = line.slice(0, strIndex) + ch + line.slice(endIndex);
        }
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
            // No default
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
            // No default
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
