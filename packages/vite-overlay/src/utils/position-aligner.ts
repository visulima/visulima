/**
 * Attempts to realign original source positions when source maps are incomplete or inaccurate.
 * Uses heuristic matching to find the corresponding location in the original source.
 * @param compiledSource - The compiled source code
 * @param compiledLine - Line number in compiled source (1-based)
 * @param compiledColumn - Column number in compiled source (1-based)
 * @param originalSource - The original source code
 * @returns Realigned position or null if no match found
 */
export const realignOriginalPosition = (
    compiledSource: string,
    compiledLine: number,
    compiledColumn: number,
    originalSource: string,
): { line: number; column: number } | null => {
    const getLine = (src: string, line: number) => src.split(/\n/g)[line - 1] ?? "";

    const removeWhitespace = (s: string) => s.replace(/\s+/g, "");

    const compiledLineText = getLine(compiledSource, compiledLine);
    const compiledLineTrimmed = compiledLineText.trim();

    if (!compiledLineText) {
        return null;
    }

    const originalLines = originalSource.split(/\n/g);

    // Extract candidate token around the compiled column
    let candidateToken = "";

    if (compiledColumn > 0 && compiledColumn <= compiledLineText.length) {
        const start = Math.max(0, compiledColumn - 1);
        const contextWindow = compiledLineText.slice(start, start + 64);

        // Try to capture a meaningful identifier token first
        const tokenMatch = /[A-Za-z_$][A-Za-z0-9_$]{2,}/.exec(contextWindow);

        if (tokenMatch?.[0]) {
            candidateToken = tokenMatch[0];
        } else {
            // Fallback to trimmed context
            candidateToken = contextWindow.trim();
            if (candidateToken.length < 4) {
                // Try broader context if token is too short
                const broaderContext = compiledLineText.slice(Math.max(0, start - 16), start + 16).trim();
                candidateToken = broaderContext;
            }
        }
    }

    // Strategy 1: Token-based search (most precise)
    if (candidateToken && candidateToken.length >= 3) {
        for (let i = 0; i < originalLines.length; i++) {
            const lineText = originalLines[i];

            if (lineText) {
                const tokenIndex = lineText.indexOf(candidateToken);
            
                if (tokenIndex >= 0) {
                    return { line: i + 1, column: tokenIndex + 1 };
                }
            }
        }
    }

    // Strategy 2: Full line substring match
    if (compiledLineTrimmed) {
        for (let i = 0; i < originalLines.length; i++) {
            const lineText = originalLines[i];

            if (lineText) {
                const lineIndex = lineText.indexOf(compiledLineTrimmed);
            
                if (lineIndex >= 0) {
                    return { line: i + 1, column: lineIndex + 1 };
                }
            }
        }
    }

    // Strategy 3: Whitespace-insensitive full line match
    if (compiledLineTrimmed) {
        const normalizedCompiled = removeWhitespace(compiledLineTrimmed);
        
        if (normalizedCompiled) {
            for (let i = 0; i < originalLines.length; i++) {
                const lineText = originalLines[i];
        
                if (lineText) {
                    const normalizedOriginal = removeWhitespace(lineText);
                    const matchIndex = normalizedOriginal.indexOf(normalizedCompiled);

                    if (matchIndex >= 0) {
                        // Map normalized position back to original position
                        let nonWhitespaceCount = 0;
        
                        for (let j = 0; j < lineText.length; j++) {
                            const char = lineText[j];
        
                            if (typeof char !== 'string') {
                                continue;
                            }
                            
                            if (nonWhitespaceCount === matchIndex) {
                                return { line: i + 1, column: j + 1 };
                            }
        
                            if (!/\s/.test(char)) {
                                nonWhitespaceCount++;
                            }
                        }
                    }
                }
            }
        }
    }

    return null;
};
