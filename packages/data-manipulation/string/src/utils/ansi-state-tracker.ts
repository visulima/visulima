/**
 * Tracks ANSI color state to ensure proper color continuation across text operations
 */
class AnsiStateTracker {
    private activeForeground: string | null = null;

    private activeBackground: string | null = null;

    // Track other formatting (bold, italic, etc.)
    private activeFormatting: string[] = [];

    /**
     * Processes an escape sequence and updates the internal state
     * @param sequence The escape sequence to process
     */

    public processEscape(sequence: string): void {
        // Extract the numeric code from the sequence
        // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
        const match = /\x1B\[(\d+)m/.exec(sequence);

        if (!match) {
            return;
        }

        const code = Number.parseInt(match[1] as string, 10);

        // Handle different ANSI code ranges
        switch (code) {
            case 0: {
                // Reset all states
                this.activeForeground = null;
                this.activeBackground = null;
                this.activeFormatting = [];
                break;
            }
            case 39: {
                // Reset foreground color only
                this.activeForeground = null;
                break;
            }
            case 49: {
                // Reset background color only
                this.activeBackground = null;
                break;
            }
            default: {
                if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
                    // Foreground colors
                    this.activeForeground = sequence;
                } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
                    // Background colors
                    this.activeBackground = sequence;
                } else if ([1, 2, 3, 4, 7, 8, 9].includes(code)) {
                    // Text formatting
                    this.activeFormatting.push(sequence);
                } else if ([22, 23, 24, 27, 28, 29].includes(code)) {
                    // Create a mapping to avoid nested switch
                    const formatResetMap: Record<number, string> = {
                        22: "[1m", // Reset bold
                        23: "[3m", // Reset italic
                        24: "[4m", // Reset underline
                        27: "[7m", // Reset inverse
                        28: "[8m", // Reset hidden
                        29: "[9m", // Reset strikethrough
                    };

                    const formatToRemove = formatResetMap[code] as string;

                    if (formatToRemove) {
                        this.activeFormatting = this.activeFormatting.filter((fmt) => !fmt.includes(formatToRemove));
                    }
                }
            }
        }
    }

    /**
     * Gets all active escape sequences to apply
     * @returns String with all active escapes
     */
    public getStartEscapesForAllActiveAttributes(): string {
        // First add background, then foreground, then all formatting
        return [this.activeBackground, this.activeForeground, ...this.activeFormatting].filter(Boolean).join("");
    }

    /**
     * Gets all closing escape sequences for the currently active attributes.
     * The order is generally reverse of application: formatting, foreground, background.
     * @returns String with all necessary closing escapes.
     */
    public getEndEscapesForAllActiveAttributes(): string {
        const closingEscapes: string[] = [];

        // Close formatting attributes - in reverse order of common application for nesting
        // This simple approach might need refinement for perfectly nested SGR codes,
        // but for typical usage (bold, italic, underline) it's often sufficient.
        // A more robust solution would track exact pairs or use a stack.
        if (this.activeFormatting.length > 0) {
            // General reset for formatting can be complex if not just resetting all (22, 23, etc.)
            // For simplicity, we'll add specific resets if we know the opening code.
            // This part needs to be smarter based on how activeFormatting stores codes.
            // Assuming activeFormatting stores codes like "\x1B[1m", "\x1B[3m"
            const formatResetMap: { [key: string]: string } = {
                "\u001B[1m": "\u001B[22m", // Bold
                "\u001B[2m": "\u001B[22m", // Faint/Dim (also reset by 22)
                "\u001B[3m": "\u001B[23m", // Italic
                "\u001B[4m": "\u001B[24m", // Underline
                "\u001B[7m": "\u001B[27m", // Inverse
                "\u001B[8m": "\u001B[28m", // Hidden/Conceal
                "\u001B[9m": "\u001B[29m", // Strikethrough
            };

            // Iterate in reverse for arguably better visual nesting behavior on reset
            [...this.activeFormatting].reverse().forEach((formatCode) => {
                const resetCode = formatResetMap[formatCode];

                if (resetCode) {
                    closingEscapes.push(resetCode);
                }
            });
        }

        if (this.activeForeground) {
            closingEscapes.push("\u001B[39m"); // Default foreground color
        }

        if (this.activeBackground) {
            closingEscapes.push("\u001B[49m"); // Default background color
        }

        return closingEscapes.join("");
    }
}

export default AnsiStateTracker;
