/**
 * Error location finding utilities for source code
 */

/**
 * Checks if a template literal in source code could resolve to the target error message
 * @param line The source code line containing a template literal
 * @param targetMessage The error message we're looking for
 * @returns true if the template could resolve to the target message
 */
const checkTemplateLiteralMatch = (line: string, targetMessage: string): boolean => {
    // Extract template literals from the line
    const templateLiteralRegex = /`([^`]*(?:\$\{[^}]+\}[^`]*)*)`/g;
    const matches = [...line.matchAll(templateLiteralRegex)];

    for (const match of matches) {
        const templateContent = match[1]; // Content inside the backticks

        // Replace template expressions with wildcards for pattern matching
        const pattern = templateContent.replaceAll(/\$\{[^}]+\}/g, "(.+?)");

        // Create a regex that allows flexible matching of template variables
        try {
            const regex = new RegExp(`^${pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}$`);

            if (regex.test(targetMessage)) {
                return true;
            }
        } catch {
            // Invalid regex pattern, skip
            continue;
        }

        // Also try a simpler approach: check if target message contains the static parts
        const staticParts = templateContent.split(/\$\{[^}]+\}/);
        const hasAllStaticParts = staticParts.every((part) => part === "" || targetMessage.includes(part));

        if (hasAllStaticParts && staticParts.length > 1) {
            return true;
        }
    }

    return false;
};

/**
 * Searches for error message in source code to find exact line and column
 * This is more reliable than source maps for runtime errors
 * @param sourceCode The source code to search in
 * @param errorMessage The error message to find
 * @param occurrenceIndex Which occurrence to find (0-based)
 * @returns The line and column where the error was found, or null if not found
 */
export const findErrorInSourceCode = (sourceCode: string, errorMessage: string, occurrenceIndex: number = 0): { column: number; line: number } | null => {
    if (!sourceCode || !errorMessage) {
        return null;
    }

    const lines = sourceCode.split("\n");

    // For dynamic error messages, extract the base pattern
    // Handle different types of runtime errors
    const dynamicErrorPatterns = [
        /Failed to resolve import ["']([^"']+)["'](?:\s+from ["']([^"']+)["'])?/, // Import resolution errors
        /(.+?)\s+from line \d+/, // "Error from line X"
        /(.+?)\s+is not defined/, // "variable is not defined"
        /(.+?)\s+is not a function/, // "function is not a function"
        /Cannot read properties of (.+?)\s+\(reading (.+?)\)/, // "Cannot read properties of null (reading property)"
    ];

    let dynamicMatch = null;

    for (const pattern of dynamicErrorPatterns) {
        dynamicMatch = errorMessage.match(pattern);

        if (dynamicMatch) break;
    }

    // Common error patterns to search for
    const errorPatterns = [
        // Direct error message match
        errorMessage,
        // Standard Error constructor patterns
        `new Error("${errorMessage.replaceAll('"', String.raw`\"`)}")`,
        `new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
        // Template literal patterns
        `new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
        // Throw patterns for standard Error
        `throw new Error("${errorMessage.replaceAll('"', String.raw`\"`)}")`,
        `throw new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
        // Throw template literal patterns
        `throw new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
        // Function call patterns that might contain the error
        `Error("${errorMessage.replaceAll('"', String.raw`\"`)}")`,
        `Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
    ];

    // First pass: Look for custom error classes that contain the error message
    // This handles cases like: throw new CustomError("message") or new CustomError("message")
    let foundCount = 0;

    for (const [lineIndex, line] of lines.entries()) {
        if (!line) continue;

        // Check if this line contains the error message AND any error constructor pattern
        // For template literals, check if the resolved message could match the template structure
        const hasErrorMessage = line.includes(errorMessage) || checkTemplateLiteralMatch(line, errorMessage);
        const hasErrorConstructor = /throw new [A-Z]\w*\(/.test(line) || /new [A-Z]\w*\(/.test(line) || /new Error\(/.test(line);

        if (hasErrorMessage && hasErrorConstructor) {
            // Find the position of "new Error(" or similar patterns in this line
            const errorPatterns = [
                /new Error\(/,
                /throw new Error\(/,
                /new Error`/,
                /throw new Error`/,
                /new [A-Z]\w*\(/,
                /throw new [A-Z]\w*\(/,
                /new [A-Z]\w*`/,
                /throw new [A-Z]\w*`/,
            ];

            let lineMatched = false;
            let bestMatch: RegExpMatchArray | null = null;
            let bestPattern: RegExp | null = null;

            // First find the best match for this line (prioritize throw patterns)
            for (const pattern of errorPatterns) {
                const match = line.match(pattern);

                if (match) {
                    lineMatched = true;

                    // Prefer throw patterns over new patterns
                    if (!bestMatch || (pattern.source.includes("throw") && !bestPattern?.source.includes("throw"))) {
                        bestMatch = match;
                        bestPattern = pattern;
                    }
                }
            }

            if (lineMatched && bestMatch && bestPattern) {
                foundCount++;

                if (foundCount > occurrenceIndex) {
                    // For patterns that include "throw new", we want the position of "new", not "throw"
                    let actualColumn = bestMatch.index!;

                    if (bestPattern.source.includes("throw new") && bestMatch[0].startsWith("throw new")) {
                        // Find the position of "new" within the match
                        const newIndex = bestMatch[0].indexOf("new");

                        if (newIndex !== -1) {
                            actualColumn += newIndex;
                        }
                    }

                    return {
                        column: actualColumn + 1, // 1-based column number (start of constructor)
                        line: lineIndex + 1, // 1-based line number
                    };
                }
            }
        }
    }

    // Add patterns for dynamic error messages
    if (dynamicMatch) {
        // Handle different types of dynamic errors
        if (dynamicMatch[0].includes("Failed to resolve import")) {
            // For import resolution errors, search for the import statement
            const importPath = dynamicMatch[1];
            // Import resolution error detected
            const specificPatterns = [
                `import.*from ["']${importPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`, // Exact import match
                `import.*["']${importPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`, // Dynamic import
                importPath, // Just the path as fallback
            ];

            errorPatterns.unshift(...specificPatterns);
        } else if (dynamicMatch[0].includes("is not defined")) {
            // For "X is not defined", search for the variable name directly
            const variableName = dynamicMatch[1];
            const specificPatterns = [
                variableName, // Direct variable reference
                `{${variableName}}`, // Template literal usage
                `src={${variableName}}`, // Common in JSX/Svelte
                `${variableName}.`, // Property access
                `=${variableName}`, // Assignment
            ];

            errorPatterns.unshift(...specificPatterns);
        } else if (dynamicMatch[0].includes("Cannot read properties")) {
            // For "Cannot read properties of X (reading Y)", search for both X and Y
            const objectName = dynamicMatch[1];
            const propertyName = dynamicMatch[2];
            const specificPatterns = [
                propertyName, // The property being accessed
                `${objectName}.${propertyName}`, // Full property access
                `${objectName}?.${propertyName}`, // Optional chaining
                `${objectName}[${propertyName}]`, // Bracket notation
            ];

            errorPatterns.unshift(...specificPatterns);
        } else {
            // For other dynamic errors like "Error from line X"
            const baseMessage = dynamicMatch[1];
            const specificPatterns = [
                // Template literal version (most common for dynamic errors)
                `new Error(\`${baseMessage}`,
                `throw new Error(\`${baseMessage}`,
                // String concatenation version
                `new Error("${baseMessage}`,
                `new Error('${baseMessage}`,
                `throw new Error("${baseMessage}`,
                `throw new Error('${baseMessage}`,
                // Exact match of the full error message
                `new Error("${errorMessage.replaceAll('"', String.raw`\"`)}")`,
                `new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
                `throw new Error("${errorMessage.replaceAll('"', String.raw`\"`)}")`,
                `throw new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
                // Template literal version
                `new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
                `throw new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
            ];

            errorPatterns.unshift(...specificPatterns);
        }
    }

    for (const [lineIndex, line] of lines.entries()) {
        if (!line) continue;

        // Check for template literal matches in this line
        if (checkTemplateLiteralMatch(line, errorMessage)) {
            // Look for error constructor patterns in the same line
            const constructorPatterns = [
                /new Error\(/,
                /throw new Error\(/,
                /new Error`/,
                /throw new Error`/,
                /new [A-Z]\w*\(/,
                /throw new [A-Z]\w*\(/,
                /new [A-Z]\w*`/,
                /throw new [A-Z]\w*`/,
            ];

            let lineMatched = false;
            let bestMatch: RegExpMatchArray | null = null;
            let bestPattern: RegExp | null = null;

            // First find the best match for this line (prioritize throw patterns)
            for (const pattern of constructorPatterns) {
                const match = line.match(pattern);

                if (match) {
                    lineMatched = true;

                    // Prefer throw patterns over new patterns
                    if (!bestMatch || (pattern.source.includes("throw") && !bestPattern?.source.includes("throw"))) {
                        bestMatch = match;
                        bestPattern = pattern;
                    }
                }
            }

            if (lineMatched && bestMatch && bestPattern) {
                foundCount++;

                if (foundCount > occurrenceIndex) {
                    let actualColumn = bestMatch.index!;

                    if (bestPattern.source.includes("throw new") && bestMatch[0].startsWith("throw new")) {
                        const newIndex = bestMatch[0].indexOf("new");

                        if (newIndex !== -1) {
                            actualColumn += newIndex;
                        }
                    }

                    return {
                        column: actualColumn + 1, // 1-based column number (start of constructor)
                        line: lineIndex + 1, // 1-based line number
                    };
                }
            }
        }

        // Also check regular pattern matching
        let lineMatched = false;
        let bestPatternIndex = -1;
        let bestPattern: string | null = null;

        // Find the best pattern match for this line
        for (const pattern of errorPatterns) {
            const patternIndex = line.indexOf(pattern);

            if (patternIndex !== -1) {
                lineMatched = true;

                // Use the first match found (patterns are ordered by priority)
                if (bestPatternIndex === -1) {
                    bestPatternIndex = patternIndex;
                    bestPattern = pattern;
                }
            }
        }

        if (lineMatched && bestPatternIndex !== -1 && bestPattern) {
            foundCount++;

            if (foundCount > occurrenceIndex) {
                let actualColumn = bestPatternIndex + 1;

                // Handle different types of dynamic errors
                if (dynamicMatch) {
                    if (dynamicMatch[0].includes("Failed to resolve import")) {
                        // For import resolution errors, point to the import path
                        const importPath = dynamicMatch[1];

                        if (line.includes(`"${importPath}"`) || line.includes(`'${importPath}'`)) {
                            // Find the position of the import path in the line
                            const quoteChar = line.includes(`"${importPath}"`) ? '"' : "'";
                            const pathStart = line.indexOf(`${quoteChar}${importPath}${quoteChar}`);

                            actualColumn = pathStart + 1; // 1-based column at the start of the import path
                        }
                    } else if (dynamicMatch[0].includes("is not defined")) {
                        // For variable references, point to the variable name
                        const variableName = dynamicMatch[1];

                        if (bestPattern === variableName) {
                            // Direct variable reference - point to the start of the variable
                            actualColumn = bestPatternIndex + 1; // 1-based column
                        } else if (bestPattern.includes(variableName)) {
                            // Pattern contains variable - find variable position within pattern
                            const variableIndex = bestPattern.indexOf(variableName);

                            actualColumn = bestPatternIndex + variableIndex + 1; // 1-based column
                        }
                    } else if (dynamicMatch[0].includes("Cannot read properties")) {
                        // For property access, point to the property being accessed
                        const propertyName = dynamicMatch[2];

                        if (bestPattern.includes(propertyName)) {
                            const propertyIndex = bestPattern.indexOf(propertyName);

                            actualColumn = bestPatternIndex + propertyIndex + 1; // 1-based column
                        }
                    } else if (bestPattern.includes("new Error(")) {
                        // For Error constructors, point to "new Error("
                        actualColumn = line.indexOf("new Error(") + 1;
                    }
                } else {
                    // For non-dynamic errors, point to the start of the found pattern
                    actualColumn = bestPatternIndex + 1; // 1-based column
                }

                return {
                    column: actualColumn, // 1-based column number
                    line: lineIndex + 1, // 1-based line number
                };
            }
        }
    }

    return null;
};
