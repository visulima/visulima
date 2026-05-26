/**
 * JUnit-XML emitter for `vis audit`.
 *
 * Each (package, advisory) pair becomes a `<testcase>` and each finding
 * is reported via a `<failure>` child. Policy decisions land in their
 * own `<testsuite>` so CI dashboards can render the two streams
 * separately.
 *
 * Output is Surefire-flavoured — the dialect GitLab CI, GitHub Actions
 * test-reporter actions and Jenkins all parse without a plugin.
 */

import type { SecurityVulnerability } from "../security/advisories";
import type { PolicyDecision } from "../security/policies";
import { severityLabel } from "./finding";

export interface JUnitAuditFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

export interface JUnitAuditEmitOptions {
    findings: JUnitAuditFinding[];
    /** Fixed timestamp for reproducible test output. */
    now?: Date;
    policyDecisions?: PolicyDecision[];
    /** Surface name — stamped into `<testsuites name>`. */
    suiteName?: string;
}

/**
 * Escapes the five XML predefined entities for attribute values and
 * element text. CDATA blocks handle the long descriptions where naive
 * escaping would explode the line count.
 */
const escapeAttribute = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&apos;");

/** Wraps text in CDATA, defensively splitting any embedded `]]>` sequences. */
const cdata = (value: string): string => `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

type TestCaseStatus = "failure" | "passing" | "skipped";

interface TestCase {
    classname: string;
    failureMessage: string;
    failureText: string;
    failureType: string;
    name: string;
    status: TestCaseStatus;
    /** Optional `<system-out>` body — used for `passing` info-level rows. */
    systemOut?: string;
}

const renderTestcase = (testcase: TestCase): string => {
    let inner = "";

    if (testcase.status === "skipped") {
        inner = `      <skipped/>\n`;
    } else if (testcase.status === "failure") {
        inner = `      <failure type="${escapeAttribute(testcase.failureType)}" message="${escapeAttribute(testcase.failureMessage)}">${cdata(testcase.failureText)}</failure>\n`;
    } else if (testcase.systemOut !== undefined) {
        inner = `      <system-out>${cdata(testcase.systemOut)}</system-out>\n`;
    }

    return `    <testcase classname="${escapeAttribute(testcase.classname)}" name="${escapeAttribute(testcase.name)}">\n${inner}    </testcase>\n`;
};

const renderTestsuite = (name: string, testcases: TestCase[], timestamp: string): string => {
    const failures = testcases.filter((t) => t.status === "failure").length;
    const skipped = testcases.filter((t) => t.status === "skipped").length;
    const tests = testcases.length;
    const inner = testcases.map(renderTestcase).join("");

    return `  <testsuite name="${escapeAttribute(name)}" tests="${String(tests)}" failures="${String(failures)}" skipped="${String(skipped)}" errors="0" timestamp="${escapeAttribute(timestamp)}" time="0">\n${inner}  </testsuite>\n`;
};

/**
 * Builds a Surefire-compatible JUnit XML document from audit findings.
 * Always returns a single `<testsuites>` root, even when both suites
 * are empty, so downstream parsers don't choke on an empty file.
 */
export const emitJUnitAudit = (options: JUnitAuditEmitOptions): string => {
    const timestamp = (options.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "");
    const suiteName = options.suiteName ?? "vis-audit";

    const vulnCases: TestCase[] = options.findings.map((finding) => {
        const { acknowledged, packageName, packageVersion, vulnerability: vuln } = finding;
        const fixHint = vuln.fixedVersions.length > 0 ? ` (fix: ${vuln.fixedVersions.join(", ")})` : "";

        return {
            classname: `${packageName}@${packageVersion}`,
            failureMessage: `${severityLabel(vuln.severity).toUpperCase()} ${vuln.id} — ${vuln.summary.split("\n")[0]?.slice(0, 200) ?? vuln.id}`,
            failureText: `${vuln.id}: ${packageName}@${packageVersion}\n${vuln.summary || `Advisory ${vuln.id}`}${fixHint}`,
            failureType: severityLabel(vuln.severity).toUpperCase(),
            name: vuln.id,
            status: acknowledged ? "skipped" : "failure",
        };
    });

    const policyCases: TestCase[] = (options.policyDecisions ?? [])
        .filter((decision) => decision.policy !== "vulnerability")
        .map((decision) => {
            let status: TestCaseStatus;

            if (decision.acceptedRisk) {
                status = "skipped";
            } else if (decision.severity === "info") {
                status = "passing";
            } else {
                status = "failure";
            }

            return {
                classname: `${decision.packageName}@${decision.version}`,
                failureMessage: `${decision.severity.toUpperCase()} vis.policy.${decision.policy}`,
                failureText: decision.reason,
                failureType: decision.severity.toUpperCase(),
                name: `vis.policy.${decision.policy}`,
                status,
                ...(status === "passing" ? { systemOut: decision.reason } : {}),
            };
        });

    const totalTests = vulnCases.length + policyCases.length;
    const totalFailures = vulnCases.filter((t) => t.status === "failure").length + policyCases.filter((t) => t.status === "failure").length;
    const totalSkipped = vulnCases.filter((t) => t.status === "skipped").length + policyCases.filter((t) => t.status === "skipped").length;

    let body = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="${escapeAttribute(suiteName)}" tests="${String(totalTests)}" failures="${String(totalFailures)}" skipped="${String(totalSkipped)}" errors="0" time="0">\n`;

    body += renderTestsuite("vulnerabilities", vulnCases, timestamp);

    if (policyCases.length > 0) {
        body += renderTestsuite("policies", policyCases, timestamp);
    }

    body += `</testsuites>\n`;

    return body;
};
