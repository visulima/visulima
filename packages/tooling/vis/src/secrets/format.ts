import { readFileSync } from "node:fs";

import type { Finding } from "@visulima/secret-scanner";
import { cyan, dim, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";

const CONTEXT_RADIUS = 1;

const groupByFile = (findings: Finding[]): Map<string, Finding[]> => {
    const byFile = new Map<string, Finding[]>();

    for (const f of findings) {
        const list = byFile.get(f.file);

        if (list) {
            list.push(f);
        } else {
            byFile.set(f.file, [f]);
        }
    }

    return byFile;
};

const loadLines = (file: string): string[] | undefined => {
    try {
        return readFileSync(file, "utf8").split(/\r?\n/);
    } catch {
        return undefined;
    }
};

const caretFor = (line: string, col: number, len: number): string => {
    const clampedCol = Math.max(1, col);
    const prefix = line.slice(0, clampedCol - 1).replaceAll(/[^\t]/g, " ");

    return `${prefix}${"^".repeat(Math.max(1, len))}`;
};

/** Pretty grouped text output with file headers, context lines, and carets. */
export const formatText = (findings: Finding[], root: string, useColor: boolean): string => {
    if (findings.length === 0) {
        return useColor ? dim("No secrets detected.") : "No secrets detected.";
    }

    const color = useColor ? { cyan, dim, red, yellow } : { cyan: (s: string) => s, dim: (s: string) => s, red: (s: string) => s, yellow: (s: string) => s };
    const lines: string[] = [];
    const byFile = groupByFile(findings);

    for (const [file, items] of byFile) {
        const relativeFile = relative(root, file) || file;

        lines.push(color.cyan(relativeFile));

        const sourceLines = loadLines(file);

        for (const f of items) {
            lines.push(`  ${color.red("✖")} ${color.yellow(`[${f.ruleId}]`)} ${color.dim(`line ${String(f.startLine)}:${String(f.startColumn)}`)}`);

            if (sourceLines) {
                const start = Math.max(0, f.startLine - 1 - CONTEXT_RADIUS);
                const end = Math.min(sourceLines.length, f.startLine + CONTEXT_RADIUS);

                for (let n = start; n < end; n += 1) {
                    const lineNumber = String(n + 1).padStart(4, " ");
                    const isMatchLine = n + 1 === f.startLine;
                    const marker = isMatchLine ? color.red("▶") : " ";

                    lines.push(`    ${marker} ${color.dim(lineNumber)} │ ${sourceLines[n] ?? ""}`);

                    if (isMatchLine) {
                        const matchLen = Math.max(1, (f.endColumn ?? f.startColumn + 1) - f.startColumn);
                        const caret = caretFor(sourceLines[n] ?? "", f.startColumn, matchLen);

                        lines.push(`      ${color.dim("    │ ")}${color.red(caret)}`);
                    }
                }
            }

            lines.push("");
        }
    }

    return lines.join("\n").trimEnd();
};

/** Structured SARIF v2.1.0 output for GitHub code-scanning. */
export const formatSarif = (findings: Finding[], toolVersion: string): string =>
    JSON.stringify(
        {
            $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
            runs: [
                {
                    results: findings.map((f) => ({
                        level: "error",
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: { uri: f.file },
                                    region: {
                                        endColumn: f.endColumn,
                                        endLine: f.endLine,
                                        snippet: { text: f.match },
                                        startColumn: f.startColumn,
                                        startLine: f.startLine,
                                    },
                                },
                            },
                        ],
                        message: { text: f.description },
                        ruleId: f.ruleId,
                    })),
                    tool: {
                        driver: {
                            informationUri: "https://visulima.com/packages/secret-scanner",
                            name: "visulima-secret-scanner",
                            version: toolVersion,
                        },
                    },
                },
            ],
            version: "2.1.0",
        },
        null,
        2,
    );
