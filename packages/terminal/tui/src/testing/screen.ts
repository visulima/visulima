import { strip } from "@visulima/ansi";

export interface Screen {
    /**
     * Check if the current screen output contains the given text (ANSI-stripped).
     */
    contains: (text: string) => boolean;

    /**
     * Get all captured frames with ANSI codes stripped.
     */
    frames: () => string[];

    /**
     * Get a specific line by zero-based index from the current screen output.
     */
    line: (n: number) => string;

    /**
     * Get all non-empty lines from the current screen output.
     */
    lines: () => string[];

    /**
     * Check if the current screen output matches the given pattern (ANSI-stripped).
     */
    matches: (pattern: RegExp) => boolean;

    /**
     * Get all captured frames with ANSI codes preserved.
     */
    rawFrames: () => string[];

    /**
     * Get the last rendered frame with ANSI codes preserved.
     */
    rawText: () => string;

    /**
     * Get the last rendered frame with ANSI codes stripped.
     */
    text: () => string;
}

export const createScreen = (lastFrame: () => string | undefined, allFrames: ReadonlyArray<string>): Screen => {
    const clean = (s: string | undefined): string => {
        if (s === undefined) {
            return "";
        }

        return strip(s);
    };

    return {
        contains(text: string): boolean {
            return this.text().includes(text);
        },
        frames(): string[] {
            return allFrames.map((f) => strip(f));
        },
        line(n: number): string {
            return this.text().split("\n")[n] ?? "";
        },
        lines(): string[] {
            return this.text()
                .split("\n")
                .filter((l) => l.trim() !== "");
        },
        matches(pattern: RegExp): boolean {
            return pattern.test(this.text());
        },
        rawFrames(): string[] {
            return [...allFrames];
        },
        rawText(): string {
            return lastFrame() ?? "";
        },
        text(): string {
            return clean(lastFrame());
        },
    };
};
