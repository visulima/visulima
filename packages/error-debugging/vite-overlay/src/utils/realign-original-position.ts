/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-misused-spread */
const CONTEXT_WINDOW_SIZE = 64;
const BROADER_CONTEXT_SIZE = 16;
const MIN_TOKEN_LENGTH = 3;
const MIN_LINE_LENGTH = 4;

const NEWLINE_SPLIT_RE = /\n/;
const WHITESPACE_RE = /\s+/g;
const TOKEN_START_RE = /[A-Z_$][\w$]{2,}/i;
const WHITESPACE_CHAR_RE = /\s/;

interface Position {
    column: number;
    line: number;
}

const getLine = (source: string, line: number): string => source.split(NEWLINE_SPLIT_RE)[line - 1] ?? "";

const removeWhitespace = (s: string): string => s.replaceAll(WHITESPACE_RE, "");

const extractCandidateToken = (lineText: string, column: number): string => {
    if (column <= 0 || column > lineText.length) {
        return "";
    }

    const start = Math.max(0, column - 1);
    const contextWindow = lineText.slice(start, start + CONTEXT_WINDOW_SIZE);

    const tokenMatch = TOKEN_START_RE.exec(contextWindow);

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

const mapNormalizedToOriginalPosition = (lineText: string, normalizedPosition: number): number => {
    let nonWhitespaceCount = 0;

    for (const [index, char] of [...lineText].entries()) {
        if (typeof char !== "string") {
            continue;
        }

        if (nonWhitespaceCount === normalizedPosition) {
            return index + 1;
        }

        if (!WHITESPACE_CHAR_RE.test(char)) {
            nonWhitespaceCount += 1;
        }
    }

    return -1;
};

const tryTokenBasedSearch = (candidateToken: string, originalLines: string[]): Position | undefined => {
    if (!candidateToken || candidateToken.length < MIN_TOKEN_LENGTH) {
        return undefined;
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

    return undefined;
};

const tryLineSubstringSearch = (compiledLineTrimmed: string, originalLines: string[]): Position | undefined => {
    if (!compiledLineTrimmed) {
        return undefined;
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

    return undefined;
};

const tryWhitespaceInsensitiveSearch = (compiledLineTrimmed: string, originalLines: string[]): Position | undefined => {
    if (!compiledLineTrimmed) {
        return undefined;
    }

    const normalizedCompiled = removeWhitespace(compiledLineTrimmed);

    if (!normalizedCompiled) {
        return undefined;
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

    return undefined;
};

const realignOriginalPosition = (compiledSource: string, compiledLine: number, compiledColumn: number, originalSource: string): Position | undefined => {
    const compiledLineText = getLine(compiledSource, compiledLine);

    if (!compiledLineText) {
        return undefined;
    }

    const originalLines = originalSource.split(NEWLINE_SPLIT_RE);
    const candidateToken = extractCandidateToken(compiledLineText, compiledColumn);

    return (
        tryTokenBasedSearch(candidateToken, originalLines)
        || tryLineSubstringSearch(compiledLineText.trim(), originalLines)
        || tryWhitespaceInsensitiveSearch(compiledLineText.trim(), originalLines)
    );
};

export default realignOriginalPosition;
