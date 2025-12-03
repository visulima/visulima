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
 * @param str The string to escape
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
    /(.+?)\s+from line \d+/,
    /(.+?)\s+is not defined/,
    /(.+?)\s+is not a function/,
    /Cannot read properties of (.+?)\s+\(reading (.+?)\)/,
] as const;

/**
 * Finds dynamic error patterns and extracts relevant information.
 * @param errorMessage The error message to analyze
 * @returns The match result if found, null otherwise
 */
const findDynamicErrorMatch = (errorMessage: string): RegExpMatchArray | null => {
    for (const pattern of DYNAMIC_ERROR_PATTERNS) {
        const match = errorMessage.match(pattern);

        if (match) {
            return match;
        }
    }

    return null;
};

/**
 * Finds the best error constructor pattern match in a line.
 * @param line The line to search in
 * @returns Object with match details or null if not found
 */
const findBestErrorConstructor = (line: string) => {
    let bestMatch: RegExpMatchArray | null = null;
    let bestPattern: RegExp | null = null;

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
    let actualColumn = match.index!;

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
 * @returns The line and column location of the error, or null if not found
 */
const findErrorInSourceCode = (sourceCode: string, errorMessage: string, occurrenceIndex: number = 0): { column: number; line: number } | null => {
    if (!sourceCode || !errorMessage) {
        return null;
    }

    const lines = sourceCode.split("\n");
    const dynamicMatch = findDynamicErrorMatch(errorMessage);
    const errorPatterns = createErrorPatterns(errorMessage);

    /**
     * Processes lines with error constructors to find the error location.
     * @param lines Array of source code lines
     * @param errorMessage The error message to find
     * @param occurrenceIndex Which occurrence to find
     * @returns The location if found, null otherwise
     */
    const processErrorConstructorLines = (lines: string[], errorMessage: string, occurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of lines.entries()) {
            if (!line) {
                continue;
            }

            const hasErrorMessage = line.includes(errorMessage) || checkTemplateLiteralMatch(line, errorMessage);
            const hasErrorConstructor = ERROR_CONSTRUCTOR_PATTERNS.some((pattern) => pattern.test(line));

            if (hasErrorMessage && hasErrorConstructor) {
                const { bestMatch, bestPattern } = findBestErrorConstructor(line);

                if (bestMatch && bestPattern) {
                    foundCount++;

                    if (foundCount > occurrenceIndex) {
                        return {
                            column: calculateActualColumn(bestMatch, bestPattern),
                            line: lineIndex + 1,
                        };
                    }
                }
            }
        }

        return null;
    };

    // First pass: Look for lines with both error message and constructor
    const constructorResult = processErrorConstructorLines(lines, errorMessage, occurrenceIndex);

    if (constructorResult) {
        return constructorResult;
    }

    /**
     * Adds specific patterns based on dynamic error match.
     * @param dynamicMatch The dynamic error match result
     * @param errorMessage The original error message
     * @param errorPatterns The array to add patterns to
     */
    const addDynamicPatterns = (dynamicMatch: RegExpMatchArray, errorMessage: string, errorPatterns: string[]) => {
        if (dynamicMatch[0].includes("Failed to resolve import")) {
            const importPath = dynamicMatch[1];

            if (!importPath) {
                return;
            }

            const escapedPath = escapeRegex(importPath);

            errorPatterns.unshift(`import.*from ["']${escapedPath}["']`, `import.*["']${escapedPath}["']`, importPath);
        } else if (dynamicMatch[0].includes("is not defined")) {
            const variableName = dynamicMatch[1];

            if (!variableName) {
                return;
            }

            errorPatterns.unshift(variableName, `{${variableName}}`, `src={${variableName}}`, `${variableName}.`, `=${variableName}`);
        } else if (dynamicMatch[0].includes("Cannot read properties")) {
            const objectName = dynamicMatch[1];
            const propertyName = dynamicMatch[2];

            if (!propertyName) {
                return;
            }

            errorPatterns.unshift(propertyName, `${objectName}.${propertyName}`, `${objectName}?.${propertyName}`, `${objectName}[${propertyName}]`);
        } else {
            const baseMessage = dynamicMatch[1];

            if (!baseMessage) {
                return;
            }

            const escapedMessage = escapeRegex(errorMessage);
            const escapedBase = escapeRegex(baseMessage);

            errorPatterns.unshift(
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
     * @param lines Array of source code lines
     * @param errorMessage The error message to find
     * @param occurrenceIndex Which occurrence to find
     * @returns The location if found, null otherwise
     */
    const processTemplateLiteralLines = (lines: string[], errorMessage: string, occurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of lines.entries()) {
            if (!line || !checkTemplateLiteralMatch(line, errorMessage)) {
                continue;
            }

            const { bestMatch, bestPattern } = findBestErrorConstructor(line);

            if (bestMatch && bestPattern) {
                foundCount++;

                if (foundCount > occurrenceIndex) {
                    return {
                        column: calculateActualColumn(bestMatch, bestPattern),
                        line: lineIndex + 1,
                    };
                }
            }
        }

        return null;
    };

    /**
     * Processes general pattern matching lines.
     * @param lines Array of source code lines
     * @param errorPatterns Array of patterns to search for
     * @param dynamicMatch Dynamic error match result
     * @param errorMessage Original error message
     * @param occurrenceIndex Which occurrence to find
     * @returns The location if found, null otherwise
     */
    const processPatternLines = (lines: string[], errorPatterns: string[], dynamicMatch: RegExpMatchArray | null, occurrenceIndex: number) => {
        let foundCount = 0;

        for (const [lineIndex, line] of lines.entries()) {
            if (!line) {
                continue;
            }

            let bestPatternIndex = -1;
            let bestPattern: string | null = null;

            // Find the best matching pattern
            for (const pattern of errorPatterns) {
                const patternIndex = line.indexOf(pattern);

                if (patternIndex !== -1 && (bestPatternIndex === -1 || patternIndex < bestPatternIndex)) {
                    bestPatternIndex = patternIndex;
                    bestPattern = pattern;
                }
            }

            if (bestPatternIndex !== -1 && bestPattern) {
                foundCount++;

                if (foundCount > occurrenceIndex) {
                    return {
                        column: calculatePatternColumn(bestPatternIndex, bestPattern, line, dynamicMatch),
                        line: lineIndex + 1,
                    };
                }
            }
        }

        return null;
    };

    /**
     * Calculates column position for pattern-based matches.
     * @param patternIndex The index where the pattern was found
     * @param pattern The matched pattern
     * @param line The source line
     * @param dynamicMatch Dynamic error match result
     * @returns The calculated column position
     */
    const calculatePatternColumn = (patternIndex: number, pattern: string, line: string, dynamicMatch: RegExpMatchArray | null): number => {
        if (!dynamicMatch) {
            return patternIndex + 1;
        }

        if (dynamicMatch[0].includes("Failed to resolve import")) {
            const importPath = dynamicMatch[1];

            if (line.includes(`"${importPath}"`) || line.includes(`'${importPath}'`)) {
                const quoteChar = line.includes(`"${importPath}"`) ? "\"" : "'";

                return line.indexOf(`${quoteChar}${importPath}${quoteChar}`) + 1;
            }
        } else if (dynamicMatch[0].includes("is not defined")) {
            const variableName = dynamicMatch[1];

            if (variableName && pattern === variableName) {
                return patternIndex + 1;
            }

            if (variableName && pattern.includes(variableName)) {
                return patternIndex + pattern.indexOf(variableName) + 1;
            }
        } else if (dynamicMatch[0].includes("Cannot read properties")) {
            const propertyName = dynamicMatch[2];

            if (propertyName && pattern.includes(propertyName)) {
                return patternIndex + pattern.indexOf(propertyName) + 1;
            }
        } else if (pattern.includes("new Error(")) {
            return line.indexOf("new Error(") + 1;
        }

        return patternIndex + 1;
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
