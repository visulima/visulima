// SARIF 2.1.0 serializer for scan findings.
//
// Pure, zero-dependency. `Finding` already carries everything a SARIF result
// needs (rule id, file, line/column span, redactable match), so this is a flat
// projection — feed the output straight to GitHub code-scanning upload, or any
// SARIF-aware viewer.

import { fingerprint, legacyFingerprint } from "./fingerprint";
import type { Finding } from "./types";

/** A SARIF 2.1.0 log object (the subset this serializer emits). */
export interface SarifLog {
    $schema: string;
    runs: SarifRun[];
    version: "2.1.0";
}

interface SarifRun {
    results: SarifResult[];
    tool: {
        driver: {
            informationUri?: string;
            name: string;
            rules: SarifReportingDescriptor[];
            version?: string;
        };
    };
}

interface SarifReportingDescriptor {
    fullDescription?: { text: string };
    id: string;
    name?: string;
    properties?: { tags?: string[] };
    shortDescription?: { text: string };
}

interface SarifResult {
    level: "error";
    locations: {
        physicalLocation: {
            artifactLocation: { uri: string };
            region: {
                endColumn?: number;
                endLine: number;
                startColumn: number;
                startLine: number;
            };
        };
    }[];
    message: { text: string };
    partialFingerprints?: Record<string, string>;
    properties?: Record<string, unknown>;
    ruleId: string;
}

const SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";
const TOOL_NAME = "@visulima/secret-scanner";
const TOOL_URI = "https://visulima.com/packages/secret-scanner";

export interface ToSarifOptions {
    /** Tool version stamped into `tool.driver.version` (e.g. your package version). */
    toolVersion?: string;
}

/**
 * Convert findings into a SARIF 2.1.0 log. Every finding becomes a
 * `level: "error"` result; the rule catalogue (`tool.driver.rules`) is deduped
 * from the findings so viewers can group by rule. `partialFingerprints` carries
 * the content-hash so re-runs collapse onto the same alert.
 *
 * Note: SARIF columns are 1-based and `endColumn` is exclusive; the scanner's
 * `Finding` columns are already 1-based so they map through directly.
 */
export const toSarif = (findings: ReadonlyArray<Finding>, options: ToSarifOptions = {}): SarifLog => {
    const ruleMap = new Map<string, SarifReportingDescriptor>();

    for (const finding of findings) {
        if (ruleMap.has(finding.ruleId)) {
            continue;
        }

        ruleMap.set(finding.ruleId, {
            fullDescription: finding.description ? { text: finding.description } : undefined,
            id: finding.ruleId,
            name: finding.ruleId,
            properties: finding.tags.length > 0 ? { tags: finding.tags } : undefined,
            shortDescription: finding.description ? { text: finding.description } : undefined,
        });
    }

    const results: SarifResult[] = findings.map((finding) => {
        return {
            level: "error",
            locations: [
                {
                    physicalLocation: {
                        artifactLocation: { uri: finding.file },
                        region: {
                            endColumn: finding.endColumn,
                            endLine: finding.endLine,
                            startColumn: finding.startColumn,
                            startLine: finding.startLine,
                        },
                    },
                },
            ],
            message: { text: finding.description || `Potential secret detected by rule "${finding.ruleId}".` },
            partialFingerprints: {
                legacyFingerprint: legacyFingerprint(finding),
                secretFingerprint: fingerprint(finding),
            },
            properties: {
                confidence: finding.confidence,
                ...(finding.source === undefined ? {} : { source: finding.source }),
                ...(finding.validation === undefined ? {} : { validation: finding.validation }),
            },
            ruleId: finding.ruleId,
        };
    });

    return {
        $schema: SARIF_SCHEMA,
        runs: [
            {
                results,
                tool: {
                    driver: {
                        informationUri: TOOL_URI,
                        name: TOOL_NAME,
                        rules: [...ruleMap.values()],
                        version: options.toolVersion,
                    },
                },
            },
        ],
        version: "2.1.0",
    };
};
