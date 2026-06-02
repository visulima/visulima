/**
 * JUnit-XML emitter for `vis lint` / `vis fmt --check`.
 *
 * One `&lt;testsuite>` per adapter that ran. Each finding lands as a
 * `&lt;testcase>` whose name is `&lt;file>:&lt;line>:&lt;col>` (so consumers can
 * group / sort by location) and whose `&lt;failure>` carries the human
 * message. Warnings become `&lt;failure type="warning">` rather than
 * `&lt;error>` so test dashboards distinguish at-a-glance.
 *
 * Dialect: Surefire — GitLab CI, GitHub Actions test reporters, Jenkins
 * and Bitbucket all parse this without a plugin. Mirrors the structure
 * of `src/report/junit-audit.ts` so a user familiar with `vis audit`
 * JUnit output reads `vis lint` JUnit the same way.
 */

import type { AdapterId, Finding, FindingSeverity } from "../config-types";

export interface JUnitAdapterRun {
    readonly adapter: AdapterId;
    readonly durationMs: number;
    readonly findings: ReadonlyArray<Finding>;
}

export interface JUnitEmitOptions {
    /** Fixed timestamp for reproducible test output. */
    readonly now?: Date;
    readonly runs: ReadonlyArray<JUnitAdapterRun>;
    /** Stamped into `&lt;testsuites name>`. Defaults to `vis-lint-fmt`. */
    readonly suiteName?: string;
    /** Workspace root used to relativise file paths in testcase names. */
    readonly workspaceRoot?: string;
}

const escapeAttribute = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&apos;");

const cdata = (value: string): string => `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

const compareFindings = (a: Finding, b: Finding): number => {
    if (a.file !== b.file) {
        return a.file < b.file ? -1 : 1;
    }

    return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0);
};

const failureTypeFor = (severity: FindingSeverity): string => {
    if (severity === "error") {
        return "error";
    }

    if (severity === "warning") {
        return "warning";
    }

    return "info";
};

const locationFor = (finding: Finding, workspaceRoot: string | undefined): string => {
    let { file } = finding;

    if (workspaceRoot && finding.file.startsWith(`${workspaceRoot}/`)) {
        file = finding.file.slice(workspaceRoot.length + 1);
    }

    if (finding.line === undefined) {
        return file;
    }

    if (finding.column === undefined) {
        return `${file}:${String(finding.line)}`;
    }

    return `${file}:${String(finding.line)}:${String(finding.column)}`;
};

const renderTestcase = (finding: Finding, adapter: AdapterId, workspaceRoot: string | undefined): string => {
    const name = locationFor(finding, workspaceRoot);
    const type = failureTypeFor(finding.severity);
    const headline = finding.ruleId ? `[${finding.ruleId}] ${finding.message}` : finding.message;

    return [
        `    <testcase classname="${escapeAttribute(adapter)}" name="${escapeAttribute(name)}">`,
        `      <failure type="${escapeAttribute(type)}" message="${escapeAttribute(headline)}">${cdata(finding.message)}</failure>`,
        `    </testcase>`,
        "",
    ].join("\n");
};

const renderTestsuite = (run: JUnitAdapterRun, timestamp: string, workspaceRoot: string | undefined): string => {
    const ordered = [...run.findings].sort(compareFindings);
    const failures = ordered.filter((f) => f.severity === "error").length;
    const warnings = ordered.filter((f) => f.severity === "warning").length;
    const tests = ordered.length;
    const time = (run.durationMs / 1000).toFixed(3);
    const cases = ordered.map((finding) => renderTestcase(finding, run.adapter, workspaceRoot)).join("");

    const attributes = [
        `name="${escapeAttribute(run.adapter)}"`,
        `tests="${String(tests)}"`,
        `failures="${String(failures)}"`,
        `errors="0"`,
        `skipped="${String(warnings)}"`,
        `time="${time}"`,
        `timestamp="${timestamp}"`,
    ].join(" ");

    return `  <testsuite ${attributes}>\n${cases}  </testsuite>\n`;
};

/**
 * Render a Surefire JUnit XML document. Returns a string suitable for
 * piping straight into a CI artefact — terminates with a newline.
 */
export const emitJUnit = (options: JUnitEmitOptions): string => {
    const timestamp = (options.now ?? new Date()).toISOString();
    const name = options.suiteName ?? "vis-lint-fmt";
    const suites = options.runs.map((run) => renderTestsuite(run, timestamp, options.workspaceRoot)).join("");

    const totalTests = options.runs.reduce((sum, run) => sum + run.findings.length, 0);
    const totalFailures = options.runs.reduce((sum, run) => sum + run.findings.filter((f) => f.severity === "error").length, 0);
    const totalSkipped = options.runs.reduce((sum, run) => sum + run.findings.filter((f) => f.severity === "warning").length, 0);
    const totalTime = (options.runs.reduce((sum, run) => sum + run.durationMs, 0) / 1000).toFixed(3);

    const rootAttributes = [
        `name="${escapeAttribute(name)}"`,
        `tests="${String(totalTests)}"`,
        `failures="${String(totalFailures)}"`,
        `errors="0"`,
        `skipped="${String(totalSkipped)}"`,
        `time="${totalTime}"`,
    ].join(" ");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites ${rootAttributes}>\n${suites}</testsuites>\n`;
};
