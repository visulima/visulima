import { pathToFileURL } from "node:url";

import { cyan, dim, green, red, yellow } from "@visulima/colorize";
import { readFileSync } from "@visulima/fs";
import { isAbsolute, relative, resolve } from "@visulima/path";
import type { Finding, RuleInfo } from "@visulima/secret-scanner";

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
        return readFileSync(file).split(/\r?\n/);
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

    const color = useColor
        ? { cyan, dim, green, red, yellow }
        : {
            cyan: (s: string) => s,
            dim: (s: string) => s,
            green: (s: string) => s,
            red: (s: string) => s,
            yellow: (s: string) => s,
        };
    const lines: string[] = [];
    const byFile = groupByFile(findings);

    for (const [file, items] of byFile) {
        const relativeFile = relative(root, file) || file;

        lines.push(color.cyan(relativeFile));

        const sourceLines = loadLines(file);

        for (const f of items) {
            // Provenance + quality signal ride next to the rule id so every line of
            // text output is self-describing (`kingfisher, medium`). Gitleaks rules
            // without an explicit confidence render their "low" default — call it
            // out rather than hiding it so users see the floor that's being applied.
            const provenance = [f.source, f.confidence].filter(Boolean).join(", ");
            const provenanceSuffix = provenance ? ` ${color.dim(`(${provenance})`)}` : "";
            const alternates = f.alternateMatches && f.alternateMatches.length > 0 ? ` ${color.dim(`also: ${f.alternateMatches.join(", ")}`)}` : "";
            // Validation status badge: only shown when the user opted into --validate
            // (validation is null by default). Successful verification is green, the
            // provider-rejected case is red, the network/timeout case is yellow.
            let validationBadge = "";

            switch (f.validation) {
                case "error": {
                    validationBadge = ` ${color.yellow("! error")}`;

                    break;
                }
                case "rejected": {
                    validationBadge = ` ${color.red("✗ rejected")}`;

                    break;
                }
                case "skipped": {
                    validationBadge = ` ${color.dim("— unverifiable")}`;

                    break;
                }
                case "verified": {
                    validationBadge = ` ${color.green("✓ verified")}`;

                    break;
                }
                // No default
            }

            lines.push(
                `  ${color.red("✖")} ${color.yellow(`[${f.ruleId}]`)}${provenanceSuffix}${validationBadge} ${color.dim(`line ${String(f.startLine)}:${String(f.startColumn)}`)}${alternates}`,
            );

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

/**
 * Convert an absolute path to a `file://` URI (SARIF-compliant) or keep a relative
 * path with forward-slash separators. Windows drive letters are handled by
 * `url.pathToFileURL`.
 */
const toSarifUri = (path: string, root: string): string => {
    if (!isAbsolute(path)) {
        return path.replaceAll("\\", "/");
    }

    try {
        return pathToFileURL(path).toString();
    } catch {
        return `file://${resolve(root, path).replaceAll("\\", "/")}`;
    }
};

/** Truncate a long description to SARIF's recommended short-description length. */
const shortText = (text: string, limit = 100): string => {
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, limit - 1).trimEnd()}…`;
};

/**
 * Structured SARIF v2.1.0 output for GitHub / GitLab code-scanning.
 *
 * Polished for spec compliance:
 *   - `artifactLocation.uri` emits `file://` URIs for absolute paths (SARIF §3.4.2).
 *   - `tool.driver.rules` lists every rule that triggered, with `shortDescription` +
 *     `fullDescription` + `helpUri` so consumer UIs can render rule detail pages.
 *   - `result.level` stays `"error"` (everything we surface is an actionable leak).
 *   - `result.ruleIndex` cross-references into `tool.driver.rules` per SARIF §3.27.6.
 */
export const formatSarif = (findings: Finding[], toolVersion: string, root: string = process.cwd(), ruleMetadata: RuleInfo[] = []): string => {
    const metaById = new Map(ruleMetadata.map((r) => [r.id, r]));
    const seenIds = new Set<string>();

    for (const f of findings) {
        seenIds.add(f.ruleId);
    }

    const ruleIds = [...new Set([...metaById.keys(), ...seenIds])].sort((a, b) => a.localeCompare(b));
    const ruleIndex = new Map(ruleIds.map((id, i) => [id, i]));

    return JSON.stringify(
        {
            $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
            runs: [
                {
                    originalUriBaseIds: {
                        SRCROOT: { uri: pathToFileURL(root).toString() },
                    },
                    results: findings.map((f) => {
                        const properties: Record<string, unknown> = {};

                        if (f.source) {
                            properties["source"] = f.source;
                        }

                        if (f.confidence) {
                            properties["confidence"] = f.confidence;
                        }

                        if (f.alternateMatches && f.alternateMatches.length > 0) {
                            properties["alternateRules"] = f.alternateMatches;
                        }

                        if (f.validation) {
                            properties["validation"] = f.validation;
                        }

                        return {
                            level: "error",
                            locations: [
                                {
                                    physicalLocation: {
                                        artifactLocation: {
                                            uri: toSarifUri(f.file, root),
                                            uriBaseId: isAbsolute(f.file) ? undefined : "SRCROOT",
                                        },
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
                            message: { text: f.description || f.ruleId },
                            properties: Object.keys(properties).length > 0 ? properties : undefined,
                            ruleId: f.ruleId,
                            ruleIndex: ruleIndex.get(f.ruleId) ?? -1,
                        };
                    }),
                    tool: {
                        driver: {
                            informationUri: "https://visulima.com/packages/secret-scanner",
                            name: "visulima-secret-scanner",
                            rules: ruleIds.map((id) => {
                                const meta = metaById.get(id);
                                const description = meta?.description ?? `Detected by rule \`${id}\``;
                                const ruleProperties: Record<string, unknown> = {};

                                if (meta?.tags && meta.tags.length > 0) {
                                    ruleProperties["tags"] = meta.tags;
                                }

                                if (meta?.source) {
                                    ruleProperties["source"] = meta.source;
                                }

                                if (meta?.confidence) {
                                    ruleProperties["confidence"] = meta.confidence;
                                }

                                return {
                                    defaultConfiguration: { level: "error" },
                                    fullDescription: { text: description },
                                    helpUri: "https://visulima.com/packages/secret-scanner",
                                    id,
                                    name: id,
                                    properties: Object.keys(ruleProperties).length > 0 ? ruleProperties : undefined,
                                    shortDescription: { text: shortText(description) },
                                };
                            }),
                            version: toolVersion,
                        },
                    },
                },
            ],
            version: "2.1.0",
        },
        undefined,
        2,
    );
};
