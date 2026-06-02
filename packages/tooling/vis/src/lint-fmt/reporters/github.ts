/**
 * GitHub Actions workflow-command emitter for `vis lint` / `vis fmt --check`.
 *
 * When the command runs inside `actions/checkout`-flavoured CI, the
 * workflow runner parses `::error|warning|notice file=…,line=…,col=…::msg`
 * lines from stdout and surfaces them as PR annotations inline with the
 * diff. Spec: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 *
 * One line per finding. File paths are emitted relative to `workspaceRoot`
 * when provided so annotations resolve correctly against the checked-out
 * tree (GitHub anchors on repo-relative paths).
 */

import type { Finding, FindingSeverity } from "../config-types";

export interface GitHubAdapterRun {
    readonly findings: ReadonlyArray<Finding>;
}

export interface GitHubEmitOptions {
    readonly runs: ReadonlyArray<GitHubAdapterRun>;
    readonly workspaceRoot?: string;
}

const commandFor = (severity: FindingSeverity): "error" | "notice" | "warning" => {
    if (severity === "error") {
        return "error";
    }

    if (severity === "warning") {
        return "warning";
    }

    return "notice";
};

// GitHub's workflow-command parser requires `%`, `\r` and `\n` to be
// percent-encoded inside the message body so multi-line annotations
// don't terminate the command prematurely.
const encodeMessage = (value: string): string =>
    value
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A");

// Property values (file, title) are comma- and colon-sensitive — same
// percent encoding plus `,`, `:`, `=`.
const encodeProperty = (value: string): string =>
    encodeMessage(value)
        .replaceAll(",", "%2C")
        .replaceAll(":", "%3A")
        .replaceAll("=", "%3D");

const relativeFile = (file: string, workspaceRoot: string | undefined): string => {
    if (workspaceRoot && file.startsWith(`${workspaceRoot}/`)) {
        return file.slice(workspaceRoot.length + 1);
    }

    return file;
};

const compareFindings = (a: Finding, b: Finding): number => {
    if (a.file !== b.file) {
        return a.file < b.file ? -1 : 1;
    }

    return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0);
};

const renderFinding = (finding: Finding, workspaceRoot: string | undefined): string => {
    const command = commandFor(finding.severity);
    const file = relativeFile(finding.file, workspaceRoot);
    const title = finding.ruleId ? `${finding.adapter}(${finding.ruleId})` : finding.adapter;

    const properties: string[] = [`file=${encodeProperty(file)}`];

    if (finding.line !== undefined) {
        properties.push(`line=${String(finding.line)}`);
    }

    if (finding.endLine !== undefined) {
        properties.push(`endLine=${String(finding.endLine)}`);
    }

    if (finding.column !== undefined) {
        properties.push(`col=${String(finding.column)}`);
    }

    if (finding.endColumn !== undefined) {
        properties.push(`endColumn=${String(finding.endColumn)}`);
    }

    properties.push(`title=${encodeProperty(title)}`);

    return `::${command} ${properties.join(",")}::${encodeMessage(finding.message)}\n`;
};

/**
 * Render a stream of GitHub Actions workflow commands. Returns a single
 * string with one command per line; safe to pipe directly to stdout
 * inside an Actions runner.
 */
export const emitGitHub = (options: GitHubEmitOptions): string => {
    const findings = options.runs.flatMap((run) => [...run.findings]).sort(compareFindings);

    return findings.map((finding) => renderFinding(finding, options.workspaceRoot)).join("");
};
