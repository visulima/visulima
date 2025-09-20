const CONTEXT_WINDOW_SIZE = 64;
const BROADER_CONTEXT_SIZE = 16;
const MIN_TOKEN_LENGTH = 3;
const MIN_LINE_LENGTH = 4;

interface Position {
    column: number;
    line: number;
}

const getLine = (source: string, line: number): string => source.split(/\n/g)[line - 1] ?? "";

const removeWhitespace = (s: string): string => s.replaceAll(/\s+/g, "");

const extractCandidateToken = (lineText: string, column: number): string => {
    if (column <= 0 || column > lineText.length) {
        return "";
    }

    const start = Math.max(0, column - 1);
    const contextWindow = lineText.slice(start, start + CONTEXT_WINDOW_SIZE);

    const tokenMatch = /[A-Z_$][\w$]{2,}/i.exec(contextWindow);

    if (tokenMatch?.[0]) {
        return tokenMatch[0];
    }

    let candidateToken = contextWindow.trim();

    if (candidateToken.length < MIN_LINE_LENGTH) {
        const broaderContext = lineText.slice(Math.max(0, start - BROADER_CONTEXT_SIZE), start + BROADER_CONTEXT_SIZE).trim();

        candidateToken = broaderContext;
    }

    return candidateToken;
};

const tryTokenBasedSearch = (candidateToken: string, originalLines: string[]): Position | null => {
    if (!candidateToken || candidateToken.length < MIN_TOKEN_LENGTH) {
        return null;
    }

    for (const [index, lineText] of originalLines.entries()) {
        if (!lineText) {
            continue;
        }

        const tokenIndex = lineText.indexOf(candidateToken);

        if (tokenIndex !== -1) {
            return { column: tokenIndex + 1, line: index + 1 };
        }
    }

    return null;
};

const tryLineSubstringSearch = (compiledLineTrimmed: string, originalLines: string[]): Position | null => {
    if (!compiledLineTrimmed) {
        return null;
    }

    for (const [index, lineText] of originalLines.entries()) {
        if (!lineText) {
            continue;
        }

        const lineIndex = lineText.indexOf(compiledLineTrimmed);

        if (lineIndex !== -1) {
            return { column: lineIndex + 1, line: index + 1 };
        }
    }

    return null;
};

const tryWhitespaceInsensitiveSearch = (compiledLineTrimmed: string, originalLines: string[]): Position | null => {
    if (!compiledLineTrimmed) {
        return null;
    }

    const normalizedCompiled = removeWhitespace(compiledLineTrimmed);

    if (!normalizedCompiled) {
        return null;
    }

    for (const [index, lineText] of originalLines.entries()) {
        if (!lineText) {
            continue;
        }

        const normalizedOriginal = removeWhitespace(lineText);
        const matchIndex = normalizedOriginal.indexOf(normalizedCompiled);

        if (matchIndex !== -1) {
            const originalColumn = mapNormalizedToOriginalPosition(lineText, matchIndex);

            if (originalColumn !== -1) {
                return { column: originalColumn, line: index + 1 };
            }
        }
    }

    return null;
};

const mapNormalizedToOriginalPosition = (lineText: string, normalizedPosition: number): number => {
    let nonWhitespaceCount = 0;

    for (const [index, char] of lineText.entries()) {
        if (typeof char !== "string") {
            continue;
        }

        if (nonWhitespaceCount === normalizedPosition) {
            return index + 1;
        }

        if (!/\s/.test(char)) {
            nonWhitespaceCount++;
        }
    }

    return -1;
};
const realignOriginalPosition = (compiledSource: string, compiledLine: number, compiledColumn: number, originalSource: string): Position | null => {
    const compiledLineText = getLine(compiledSource, compiledLine);

    if (!compiledLineText) {
        return null;
    }

    const originalLines = originalSource.split(/\n/g);
    const candidateToken = extractCandidateToken(compiledLineText, compiledColumn);

    return (
        tryTokenBasedSearch(candidateToken, originalLines)
        || tryLineSubstringSearch(compiledLineText.trim(), originalLines)
        || tryWhitespaceInsensitiveSearch(compiledLineText.trim(), originalLines)
    );
};

export default realignOriginalPosition;
