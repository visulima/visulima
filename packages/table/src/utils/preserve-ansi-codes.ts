import ansiRegex from "ansi-regex";

const globalAnsiPattern = ansiRegex();

/** Preserves ANSI codes in a text slice. */
export const preserveAnsiCodes = (text: string, startIndex: number, endIndex: number): string => {
    const openCodes: string[] = [];

    let match: RegExpExecArray | null = null;

    globalAnsiPattern.lastIndex = 0;

    while ((match = globalAnsiPattern.exec(text)) !== null) {
        if (match.index > endIndex) {
            break;
        }

        const code = match[0];

        if (code === "\u001B[0m") {
            if (match.index < endIndex) {
                openCodes.length = 0;
            }
        } else if (code.startsWith("\u001B[") && match.index < endIndex) {
            openCodes.push(code);
        }
    }

    const slicedText = text.slice(startIndex, endIndex);

    return openCodes.join("") + slicedText + (openCodes.length > 0 ? "\u001B[0m" : "");
};
