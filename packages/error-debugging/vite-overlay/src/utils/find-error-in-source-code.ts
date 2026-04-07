/* eslint-disable sonarjs/prefer-regexp-exec, @typescript-eslint/restrict-template-expressions */
const TEMPLATE_LITERAL_REGEX = /`((?:[^`$]|\$\{[^}]+\})*)`/g;
const VARIABLE_PLACEHOLDER_REGEX = /\$\{[^}]+\}/g;
const REGEX_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]\\]/g;
const ERROR_CONSTRUCTOR_PATTERNS = [
    /new Error\(/,
    /throw new Error\(/,
    /new Error`/,
    /throw new Error`/,
    /new [A-Z]\w*\(/,
    /throw new [A-Z]\w*\(/,
    /new [A-Z]\w*`/,
    /throw new [A-Z]\w*`/,
] as const;

/**
 * Escapes special regex characters in a string.
 * @param string_ The string to escape
 * @returns The escaped string safe for use in regex
 */
const escapeRegex = (string_: string): string => string_.replaceAll(REGEX_SPECIAL_CHARS_REGEX, String.raw`\$&`);

/**
 * Creates various error message patterns for matching.
 * @param errorMessage The error message to create patterns for
 * @returns Array of error patterns to search for
 */
const createErrorPatterns = (errorMessage: string): string[] => {
    const escapedMessage = escapeRegex(errorMessage);

    return [
        errorMessage,
        `new Error("${escapedMessage}")`,
        `new Error('${escapedMessage}')`,
        `new Error(\`${escapeRegex(errorMessage)}\`)`,
        `throw new Error("${escapedMessage}")`,
        `throw new Error('${escapedMessage}')`,
        `throw new Error(\`${escapeRegex(errorMessage)}\`)`,
        `Error("${escapedMessage}")`,
        `Error('${escapedMessage}')`,
    ];
};

/**
 * Checks if a line contains a template literal that could match the target error message.
 * @param line The source code line to check
 * @param targetMessage The error message to match against
 * @returns True if the line contains a matching template literal
 */
const checkTemplateLiteralMatch = (line: string, targetMessage: string): boolean => {
    const matches = [...line.matchAll(TEMPLATE_LITERAL_REGEX)];

    for (const match of matches) {
        const templateContent = match[1];

        if (!templateContent) {
            continue;
        }

        const staticParts = templateContent.split(VARIABLE_PLACEHOLDER_REGEX);

        // Check if all static parts are present in the target message
        const hasAllStaticParts = staticParts.every((part) => part === "" || targetMessage.includes(part));

        if (hasAllStaticParts && staticParts.length > 1) {
            return true;
        }

        // Try regex matching for dynamic content
        if (!templateContent) {
            continue;
        }

        const pattern = templateContent.replaceAll(VARIABLE_PLACEHOLDER_REGEX, "(.+?)");

        try {
            const regex = new RegExp(`^${escapeRegex(pattern)}$`);

            if (regex.test(targetMessage)) {
                return true;
            }
        } catch {
            // Continue to next match if regex is invalid
        }
    }

    return false;
};

// Dynamic error patterns for extracting specific information
const DYNAMIC_ERROR_PATTERNS = [
    /Failed to resolve import ["']([^"']+)["'](?:\s+from ["']([^"']+)["'])?/,
    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    /(.+?)\s+from line \d+/,
    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    /(.+?)\s+is not defined/,
    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    /(.+?)\s+is not a function/,
    // eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
    /Cannot read properties of (.+?)\s+\(reading (.+?)\)/,
] as const;

/**
 * Finds dynamic error patterns and extracts relevant information.
 * @param errorMessage The error message to analyze
 * @returns The match result if found, undefined otherwise
 */
const findDynamicErrorMatch = (errorMessage: string): RegExpMatchArray | undefined => {
    for (const pattern of DYNAMIC_ERROR_PATTERNS) {
        const match = errorMessage.match(pattern);

        if (match) {
            return match;
        }
    }

    return undefined;
};

/**
 * Finds the best error constructor pattern match in a line.
 * @param line The line to search in
 * @returns Object with match details or undefined if not found
 */
const findBestErrorConstructor = (line: string) => {
    let bestMatch: RegExpMatchArray | undefined;
    let bestPattern: RegExp | undefined;

    for (const pattern of ERROR_CONSTRUCTOR_PATTERNS) {
        const match = line.match(pattern);

        if (
            match // Prefer "throw new" over just "new" for better accuracy
            && (!bestMatch || (pattern.source.includes("throw") && !bestPattern?.source.includes("throw")))
        ) {
            bestMatch = match;
            bestPattern = pattern;
        }
    }

    return { bestMatch, bestPattern };
};

/**
 * Calculates the actual column position based on the match and pattern.
 * @param match The regex match
 * @param pattern The regex pattern used
 * @returns The calculated column position
 */
const calculateActualColumn = (match: RegExpMatchArray, pattern: RegExp): number => {
    let actualColumn = match.index ?? 0;

    if (pattern.source.includes("throw new") && match[0].startsWith("throw new")) {
        const newIndex = match[0].indexOf("new");

        if (newIndex !== -1) {
            actualColumn += newIndex;
        }
    }

    return actualColumn + 1; // Convert to 1-based indexing
};

/**
 * Finds the location of an error message within source code by analyzing error patterns.
 * @param sourceCode The source code to search in
 * @param errorMessage The error message to locate
 * @param occurrenceIndex The index of occurrence to find (default: 0)
 * @returns The line and column location of the error, or undefined if not found
 */
const findErrorInSourceCode = (sourceCode: string, errorMessage: string, occurrenceIndex: number = 0): { column: number; line: number } | undefined => {
    if (!sourceCode || !errorMessage) {
        return undefined;
    }

    const lines = sourceCode.split("\n");
    const dynamicMatch = findDynamicErrorMatch(errorMessage);
    const errorPatterns = createErrorPatterns(errorMessage);

    /**
     * Processes lines with error constructors to find the error location.
     * @param sourceLines Array of source code lines
     * @param targetMessage The error message to find
     * @param targetOccurrenceIndex Which occurrence to find
     * @returns The location if found, undefined otherwise
     */
    const processErrorConstructorLines = (sourceLines: string[], targetMessage: string, targetOccurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of sourceLines.entries()) {
            if (!line) {
                continue;
            }

            const hasErrorMessage = line.includes(targetMessage) || checkTemplateLiteralMatch(line, targetMessage);
            const hasErrorConstructor = ERROR_CONSTRUCTOR_PATTERNS.some((pattern) => pattern.test(line));

            if (hasErrorMessage && hasErrorConstructor) {
                const { bestMatch, bestPattern } = findBestErrorConstructor(line);

                if (bestMatch && bestPattern) {
                    foundCount += 1;

                    if (foundCount > targetOccurrenceIndex) {
                        return {
                            column: calculateActualColumn(bestMatch, bestPattern),
                            line: lineIndex + 1,
                        };
                    }
                }
            }
        }

        return undefined;
    };

    // First pass: Look for lines with both error message and constructor
    const constructorResult = processErrorConstructorLines(lines, errorMessage, occurrenceIndex);

    if (constructorResult) {
        return constructorResult;
    }

    /**
     * Adds specific patterns based on dynamic error match.
     * @param dynMatch The dynamic error match result
     * @param origMessage The original error message
     * @param patterns The array to add patterns to
     */
    const addDynamicPatterns = (dynMatch: RegExpMatchArray, origMessage: string, patterns: string[]) => {
        if (dynMatch[0].includes("Failed to resolve import")) {
            const importPath = dynMatch[1];

            if (!importPath) {
                return;
            }

            const escapedPath = escapeRegex(importPath);

            patterns.unshift(`import.*from ["']${escapedPath}["']`, `import.*["']${escapedPath}["']`, importPath);
        } else if (dynMatch[0].includes("is not defined")) {
            const variableName = dynMatch[1];

            if (!variableName) {
                return;
            }

            patterns.unshift(variableName, `{${variableName}}`, `src={${variableName}}`, `${variableName}.`, `=${variableName}`);
        } else if (dynMatch[0].includes("Cannot read properties")) {
            const objectName = dynMatch[1];
            const propertyName = dynMatch[2];

            if (!propertyName) {
                return;
            }

            patterns.unshift(propertyName, `${objectName}.${propertyName}`, `${objectName}?.${propertyName}`, `${objectName}[${propertyName}]`);
        } else {
            const baseMessage = dynMatch[1];

            if (!baseMessage) {
                return;
            }

            const escapedMessage = escapeRegex(origMessage);
            const escapedBase = escapeRegex(baseMessage);

            patterns.unshift(
                `new Error(\`${escapedBase}`,
                `throw new Error(\`${escapedBase}`,
                `new Error("${escapedBase}`,
                `new Error('${escapedBase}`,
                `throw new Error("${escapedBase}`,
                `throw new Error('${escapedBase}`,
                `new Error("${escapedMessage}")`,
                `new Error('${escapedMessage}')`,
                `throw new Error("${escapedMessage}")`,
                `throw new Error('${escapedMessage}')`,
                `new Error(\`${escapedMessage}\`)`,
                `throw new Error(\`${escapedMessage}\`)`,
            );
        }
    };

    // Add dynamic patterns if we found a dynamic match
    if (dynamicMatch) {
        addDynamicPatterns(dynamicMatch, errorMessage, errorPatterns);
    }

    /**
     * Processes template literal lines for error location.
     * @param sourceLines Array of source code lines
     * @param targetMessage The error message to find
     * @param targetOccurrenceIndex Which occurrence to find
     * @returns The location if found, undefined otherwise
     */
    const processTemplateLiteralLines = (sourceLines: string[], targetMessage: string, targetOccurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of sourceLines.entries()) {
            if (!line || !checkTemplateLiteralMatch(line, targetMessage)) {
                continue;
            }

            const { bestMatch, bestPattern } = findBestErrorConstructor(line);

            if (bestMatch && bestPattern) {
                foundCount += 1;

                if (foundCount > targetOccurrenceIndex) {
                    return {
                        column: calculateActualColumn(bestMatch, bestPattern),
                        line: lineIndex + 1,
                    };
                }
            }
        }

        return undefined;
    };

    /**
     * Calculates column position for pattern-based matches.
     * @param patternIndex The index where the pattern was found in the source line
     * @param matchedPattern The regex pattern that was matched
     * @param sourceLine The source line text being analyzed
     * @param dynMatch Dynamic error match result from template literal processing
     * @returns The calculated column position
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    const calculatePatternColumn = (patternIndex: number, matchedPattern: string, sourceLine: string, dynMatch: RegExpMatchArray | undefined): number => {
        if (!dynMatch) {
            return patternIndex + 1;
        }

        if (dynMatch[0].includes("Failed to resolve import")) {
            const importPath = dynMatch[1];

            if (sourceLine.includes(`"${importPath}"`) || sourceLine.includes(`'${importPath}'`)) {
                const quoteChar = sourceLine.includes(`"${importPath}"`) ? "\"" : "'";

                return sourceLine.indexOf(`${quoteChar}${importPath}${quoteChar}`) + 1;
            }
        } else if (dynMatch[0].includes("is not defined")) {
            const variableName = dynMatch[1];

            if (variableName && matchedPattern === variableName) {
                return patternIndex + 1;
            }

            if (variableName && matchedPattern.includes(variableName)) {
                return patternIndex + matchedPattern.indexOf(variableName) + 1;
            }
        } else if (dynMatch[0].includes("Cannot read properties")) {
            const propertyName = dynMatch[2];

            if (propertyName && matchedPattern.includes(propertyName)) {
                return patternIndex + matchedPattern.indexOf(propertyName) + 1;
            }
        } else if (matchedPattern.includes("new Error(")) {
            return sourceLine.indexOf("new Error(") + 1;
        }

        return patternIndex + 1;
    };

    /**
     * Processes general pattern matching lines.
     * @param sourceLines Array of source code lines
     * @param patternsList Array of patterns to search for
     * @param dynMatch Dynamic error match result
     * @param targetOccurrenceIndex Which occurrence to find
     * @returns The location if found, undefined otherwise
     */
    const processPatternLines = (sourceLines: string[], patternsList: string[], dynMatch: RegExpMatchArray | undefined, targetOccurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of sourceLines.entries()) {
            if (!line) {
                continue;
            }

            let bestPatternIndex = -1;
            let bestMatchedPattern: string | undefined;

            // Find the best matching pattern
            for (const pat of patternsList) {
                const patternIndex = line.indexOf(pat);

                if (patternIndex !== -1 && (bestPatternIndex === -1 || patternIndex < bestPatternIndex)) {
                    bestPatternIndex = patternIndex;
                    bestMatchedPattern = pat;
                }
            }

            if (bestPatternIndex !== -1 && bestMatchedPattern) {
                foundCount += 1;

                if (foundCount > targetOccurrenceIndex) {
                    return {
                        column: calculatePatternColumn(bestPatternIndex, bestMatchedPattern, line, dynMatch),
                        line: lineIndex + 1,
                    };
                }
            }
        }

        return undefined;
    };

    // Second pass: Look for template literal matches
    const templateResult = processTemplateLiteralLines(lines, errorMessage, occurrenceIndex);

    if (templateResult) {
        return templateResult;
    }

    // Third pass: Look for general pattern matches
    return processPatternLines(lines, errorPatterns, dynamicMatch, occurrenceIndex);
};

export default findErrorInSourceCode;
