import ansiRegex from "ansi-regex";

interface AnsiCode {
    code: string;
    index: number;
    isReset: boolean;
    isStyle: boolean;
}

/** Preserves ANSI codes in a text slice. */
export const preserveAnsiCodes = (text: string, startIndex: number, endIndex: number): string => {
    if (!text || startIndex < 0 || endIndex < startIndex) {
        return "";
    }

    // Normalize indices
    endIndex = Math.min(text.length, endIndex);

    // Collect all ANSI codes and their positions
    const codes: AnsiCode[] = [];
    const ansiPattern = ansiRegex();
    let match: RegExpExecArray | null;

    // Reset lastIndex to ensure we find all matches
    ansiPattern.lastIndex = 0;
    while ((match = ansiPattern.exec(text)) !== null) {
        const code = match[0];
        codes.push({
            code,
            index: match.index,
            isReset: code === "\u001B[0m",
            isStyle: code.match(/\u001B\[([0-9;]*)m/) !== null
        });
    }

    // Get clean text without ANSI codes
    const cleanText = text.replace(ansiPattern, "");

    // Track active styles before our slice
    const activeStyles = new Set<string>();
    const currentStyles: string[] = [];

    // Process codes before the slice to determine initial styles
    for (const code of codes) {
        if (code.index >= startIndex) break;

        if (code.isReset) {
            currentStyles.length = 0;
            activeStyles.clear();
        } else if (code.isStyle) {
            if (!activeStyles.has(code.code)) {
                currentStyles.push(code.code);
                activeStyles.add(code.code);
            }
        }
    }

    // Build result string
    let result = "";

    // Add active styles at start
    if (currentStyles.length > 0) {
        result += currentStyles.join("");
    }

    // Add text slice
    let slicedText = text.slice(startIndex, endIndex);
    let lastIndex = 0;

    // Handle codes within the slice
    for (const code of codes) {
        if (code.index < startIndex || code.index >= endIndex) continue;

        const relativeIndex = code.index - startIndex;
        result += slicedText.slice(lastIndex, relativeIndex);

        if (code.isReset) {
            // Add reset and reapply current styles
            result += code.code;
            if (currentStyles.length > 0) {
                result += currentStyles.join("");
            }
        } else if (code.isStyle) {
            result += code.code;
            if (!activeStyles.has(code.code)) {
                currentStyles.push(code.code);
                activeStyles.add(code.code);
            }
        } else {
            result += code.code;
        }

        lastIndex = relativeIndex;
    }

    // Add remaining text
    result += slicedText.slice(lastIndex);

    // Add final reset if needed
    if (currentStyles.length > 0 || activeStyles.size > 0) {
        result += "\u001B[0m";
    }

    return result;
};
