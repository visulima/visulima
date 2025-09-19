/**
 * Checks if a line contains a template literal that could match the target error message.
 * @param line The source code line to check
 * @param targetMessage The error message to match against
 * @returns True if the line contains a matching template literal
 */
const checkTemplateLiteralMatch = (line: string, targetMessage: string): boolean => {
    const templateLiteralRegex = /`([^`]*(?:\$\{[^}]+\}[^`]*)*)`/g;
    const matches = [...line.matchAll(templateLiteralRegex)];

    for (const match of matches) {
        const templateContent = match[1];

        const pattern = templateContent.replaceAll(/\$\{[^}]+\}/g, "(.+?)");

        try {
            const regex = new RegExp(`^${pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}$`);

            if (regex.test(targetMessage)) {
                return true;
            }
        } catch {
            continue;
        }

        const staticParts = templateContent.split(/\$\{[^}]+\}/);
        const hasAllStaticParts = staticParts.every((part) => part === "" || targetMessage.includes(part));

        if (hasAllStaticParts && staticParts.length > 1) {
            return true;
        }
    }

    return false;
};

/**
 * Finds the location of an error message within source code by analyzing error patterns.
 * @param sourceCode The source code to search in
 * @param errorMessage The error message to locate
 * @param occurrenceIndex The index of occurrence to find (default: 0)
 * @returns The line and column location of the error, or null if not found
 */
export const findErrorInSourceCode = (sourceCode: string, errorMessage: string, occurrenceIndex: number = 0): { column: number; line: number } | null => {
    if (!sourceCode || !errorMessage) {
        return null;
    }

    const lines = sourceCode.split("\n");

    const dynamicErrorPatterns = [
        /Failed to resolve import ["']([^"']+)["'](?:\s+from ["']([^"']+)["'])?/,
        /(.+?)\s+from line \d+/,
        /(.+?)\s+is not defined/,
        /(.+?)\s+is not a function/,
        /Cannot read properties of (.+?)\s+\(reading (.+?)\)/,
    ];

    let dynamicMatch = null;

    for (const pattern of dynamicErrorPatterns) {
        dynamicMatch = errorMessage.match(pattern);

        if (dynamicMatch)
            break;
    }

    const errorPatterns = [
        errorMessage,
        `new Error("${errorMessage.replaceAll("\"", String.raw`\"`)}")`,
        `new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
        `new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
        `throw new Error("${errorMessage.replaceAll("\"", String.raw`\"`)}")`,
        `throw new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
        `throw new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
        `Error("${errorMessage.replaceAll("\"", String.raw`\"`)}")`,
        `Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
    ];

    let foundCount = 0;

    for (const [lineIndex, line] of lines.entries()) {
        if (!line)
            continue;

        const hasErrorMessage = line.includes(errorMessage) || checkTemplateLiteralMatch(line, errorMessage);
        const hasErrorConstructor = /throw new [A-Z]\w*\(/.test(line) || /new [A-Z]\w*\(/.test(line) || /new Error\(/.test(line);

        if (hasErrorMessage && hasErrorConstructor) {
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

            for (const pattern of errorPatterns) {
                const match = line.match(pattern);

                if (match) {
                    lineMatched = true;

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
                        column: actualColumn + 1,
                        line: lineIndex + 1,
                    };
                }
            }
        }
    }

    if (dynamicMatch) {
        if (dynamicMatch[0].includes("Failed to resolve import")) {
            const importPath = dynamicMatch[1];
            const specificPatterns = [
                `import.*from ["']${importPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`,
                `import.*["']${importPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`,
                importPath,
            ];

            errorPatterns.unshift(...specificPatterns);
        } else if (dynamicMatch[0].includes("is not defined")) {
            const variableName = dynamicMatch[1];
            const specificPatterns = [variableName, `{${variableName}}`, `src={${variableName}}`, `${variableName}.`, `=${variableName}`];

            errorPatterns.unshift(...specificPatterns);
        } else if (dynamicMatch[0].includes("Cannot read properties")) {
            const objectName = dynamicMatch[1];
            const propertyName = dynamicMatch[2];
            const specificPatterns = [propertyName, `${objectName}.${propertyName}`, `${objectName}?.${propertyName}`, `${objectName}[${propertyName}]`];

            errorPatterns.unshift(...specificPatterns);
        } else {
            const baseMessage = dynamicMatch[1];
            const specificPatterns = [
                `new Error(\`${baseMessage}`,
                `throw new Error(\`${baseMessage}`,
                `new Error("${baseMessage}`,
                `new Error('${baseMessage}`,
                `throw new Error("${baseMessage}`,
                `throw new Error('${baseMessage}`,
                `new Error("${errorMessage.replaceAll("\"", String.raw`\"`)}")`,
                `new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
                `throw new Error("${errorMessage.replaceAll("\"", String.raw`\"`)}")`,
                `throw new Error('${errorMessage.replaceAll("'", String.raw`\'`)}')`,
                `new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
                `throw new Error(\`${errorMessage.replaceAll("`", "\\`")}\`)`,
            ];

            errorPatterns.unshift(...specificPatterns);
        }
    }

    for (const [lineIndex, line] of lines.entries()) {
        if (!line)
            continue;

        if (checkTemplateLiteralMatch(line, errorMessage)) {
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

            for (const pattern of constructorPatterns) {
                const match = line.match(pattern);

                if (match) {
                    lineMatched = true;

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
                        column: actualColumn + 1,
                        line: lineIndex + 1,
                    };
                }
            }
        }

        let lineMatched = false;
        let bestPatternIndex = -1;
        let bestPattern: string | null = null;

        for (const pattern of errorPatterns) {
            const patternIndex = line.indexOf(pattern);

            if (patternIndex !== -1) {
                lineMatched = true;

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

                if (dynamicMatch) {
                    if (dynamicMatch[0].includes("Failed to resolve import")) {
                        const importPath = dynamicMatch[1];

                        if (line.includes(`"${importPath}"`) || line.includes(`'${importPath}'`)) {
                            const quoteChar = line.includes(`"${importPath}"`) ? "\"" : "'";
                            const pathStart = line.indexOf(`${quoteChar}${importPath}${quoteChar}`);

                            actualColumn = pathStart + 1;
                        }
                    } else if (dynamicMatch[0].includes("is not defined")) {
                        const variableName = dynamicMatch[1];

                        if (bestPattern === variableName) {
                            actualColumn = bestPatternIndex + 1;
                        } else if (bestPattern.includes(variableName)) {
                            const variableIndex = bestPattern.indexOf(variableName);

                            actualColumn = bestPatternIndex + variableIndex + 1;
                        }
                    } else if (dynamicMatch[0].includes("Cannot read properties")) {
                        const propertyName = dynamicMatch[2];

                        if (bestPattern.includes(propertyName)) {
                            const propertyIndex = bestPattern.indexOf(propertyName);

                            actualColumn = bestPatternIndex + propertyIndex + 1;
                        }
                    } else if (bestPattern.includes("new Error(")) {
                        actualColumn = line.indexOf("new Error(") + 1;
                    }
                } else {
                    actualColumn = bestPatternIndex + 1;
                }

                return {
                    column: actualColumn,
                    line: lineIndex + 1,
                };
            }
        }
    }

    return null;
};
