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
     * @param sequence - The escape sequence to process
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public processEscape(sequence: string): void {
        // Extract the numeric code from the sequence
        // eslint-disable-next-line no-control-regex,regexp/no-control-character
        const match = /\u001B\[(\d+)m/.exec(sequence);

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

                    const formatToRemove = formatResetMap[code];
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
    public getActiveEscapes(): string {
        // First add background, then foreground, then all formatting
        return [this.activeBackground, this.activeForeground, ...this.activeFormatting].filter(Boolean).join("");
    }
}

export default AnsiStateTracker;
