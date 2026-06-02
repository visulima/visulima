/**
 * SARIF 2.1.0 reporter for `vis lint` / `vis fmt --check`.
 *
 * Output schema: https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
 *
 * One `run` element per adapter that produced findings. Adapters that
 * ran but reported nothing are still listed (with an empty `results`
 * array) so consumers can see what tools participated. Findings inside
 * a run are stable-ordered by file then line so diff-friendly checksums
 * stay deterministic between identical inputs.
 *
 * Tool driver versions are best-effort: ToolPresence carries
 * `declaredVersion` from package.json when available; otherwise the
 * driver appears without a version so SARIF consumers fall back to
 * matching by tool name.
 */

import { pathToFileURL } from "node:url";

import type { AdapterId, Finding, FindingSeverity, ToolPresence } from "../config-types";

/**
 * Per-adapter run payload accepted by the SARIF emitter. The reporter
 * doesn't need the durationMs/exitCode pair the runner returns — those
 * land in the JSON reporter; SARIF has its own `invocations` slot which
 * we intentionally skip to keep the surface lean.
 */
export interface SarifAdapterRun {
    readonly adapter: AdapterId;
    readonly findings: ReadonlyArray<Finding>;
    readonly presence?: ToolPresence;
}

export interface SarifEmitOptions {
    readonly runs: ReadonlyArray<SarifAdapterRun>;
    /** Workspace root, used to emit `originalUriBaseIds` for portability. */
    readonly workspaceRoot?: string;
}

const SARIF_VERSION = "2.1.0";
const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";

const sarifLevelFor = (severity: FindingSeverity): "error" | "note" | "warning" => {
    if (severity === "error") {
        return "error";
    }

    if (severity === "warning") {
        return "warning";
    }

    return "note";
};

const fileUri = (absolutePath: string, workspaceRoot: string | undefined): { uri: string; uriBaseId?: string } => {
    if (workspaceRoot && absolutePath.startsWith(`${workspaceRoot}/`)) {
        return { uri: absolutePath.slice(workspaceRoot.length + 1), uriBaseId: "SRCROOT" };
    }

    return { uri: absolutePath };
};

/**
 * Absolute `file://` URI for the workspace root, with a trailing slash so it
 * reads as a directory base. Defines the `SRCROOT` `uriBaseId` that
 * {@link fileUri} stamps on workspace-relative artifact locations, letting
 * SARIF consumers resolve those relatives back to an absolute path.
 */
const workspaceRootUri = (workspaceRoot: string): string => {
    const { href } = pathToFileURL(workspaceRoot);

    return href.endsWith("/") ? href : `${href}/`;
};

const compareFindings = (a: Finding, b: Finding): number => {
    if (a.file !== b.file) {
        return a.file < b.file ? -1 : 1;
    }

    return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0);
};

interface SarifReportingDescriptor {
    id: string;
    name?: string;
}

const collectRules = (findings: ReadonlyArray<Finding>): SarifReportingDescriptor[] => {
    const seen = new Map<string, SarifReportingDescriptor>();

    for (const finding of findings) {
        if (!finding.ruleId) {
            continue;
        }

        if (!seen.has(finding.ruleId)) {
            seen.set(finding.ruleId, { id: finding.ruleId, name: finding.ruleId });
        }
    }

    return [...seen.values()];
};

const buildResult = (finding: Finding, workspaceRoot: string | undefined): Record<string, unknown> => {
    const { uri, uriBaseId } = fileUri(finding.file, workspaceRoot);
    const physicalLocation: Record<string, unknown> = {
        artifactLocation: uriBaseId ? { uri, uriBaseId } : { uri },
    };

    if (finding.line !== undefined) {
        const region: Record<string, number> = { startLine: finding.line };

        if (finding.column !== undefined) {
            region.startColumn = finding.column;
        }

        if (finding.endLine !== undefined) {
            region.endLine = finding.endLine;
        }

        if (finding.endColumn !== undefined) {
            region.endColumn = finding.endColumn;
        }

        physicalLocation.region = region;
    }

    const result: Record<string, unknown> = {
        level: sarifLevelFor(finding.severity),
        locations: [{ physicalLocation }],
        message: { text: finding.message },
    };

    if (finding.ruleId) {
        result.ruleId = finding.ruleId;
    }

    return result;
};

const buildRun = (run: SarifAdapterRun, workspaceRoot: string | undefined): Record<string, unknown> => {
    const ordered = [...run.findings].sort(compareFindings);
    const rules = collectRules(ordered);

    const driver: Record<string, unknown> = {
        name: run.adapter,
        rules,
    };

    if (run.presence?.declaredVersion) {
        driver.version = run.presence.declaredVersion;
    }

    const result: Record<string, unknown> = {
        results: ordered.map((finding) => buildResult(finding, workspaceRoot)),
        tool: { driver },
    };

    // Define the SRCROOT base referenced by workspace-relative artifact
    // locations so the relative URIs are resolvable to an absolute path.
    if (workspaceRoot) {
        result.originalUriBaseIds = { SRCROOT: { uri: workspaceRootUri(workspaceRoot) } };
    }

    return result;
};

/**
 * Render a SARIF 2.1.0 document. Returns a JSON string (4-space indent
 * — matches the `vis lint --format json` reporter so the two outputs
 * read alike when diffed).
 */
export const emitSarif = (options: SarifEmitOptions): string => {
    const document: Record<string, unknown> = {
        $schema: SARIF_SCHEMA,
        runs: options.runs.map((run) => buildRun(run, options.workspaceRoot)),
        version: SARIF_VERSION,
    };

    return `${JSON.stringify(document, undefined, 2)}\n`;
};
