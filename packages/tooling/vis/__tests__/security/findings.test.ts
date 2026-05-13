import { describe, expect, it } from "vitest";

import type { MarshallFinding } from "../../src/security/marshalls/findings";
import {
    formatMarshallFindingsAsJson,
    formatMarshallFindingsAsTable,
    MarshallFindings,
} from "../../src/security/marshalls/findings";

const errorFinding = (overrides: Partial<MarshallFinding> = {}): MarshallFinding => ({
    marshall: "author",
    message: "publisher email is unverified",
    packageName: "demo",
    severity: "error",
    ...overrides,
});

const warningFinding = (overrides: Partial<MarshallFinding> = {}): MarshallFinding => ({
    marshall: "downloads",
    message: "fewer than 100 weekly downloads",
    packageName: "demo",
    severity: "warning",
    ...overrides,
});

describe(MarshallFindings, () => {
    it("is empty by default", () => {
        expect.assertions(4);

        const findings = new MarshallFindings();

        expect(findings.isEmpty()).toBe(true);
        expect(findings.size()).toBe(0);
        expect(findings.hasErrors()).toBe(false);
        expect(findings.hasWarnings()).toBe(false);
    });

    it("add() appends a single finding and surfaces it via all()", () => {
        expect.assertions(3);

        const findings = new MarshallFindings();
        const finding = errorFinding();

        findings.add(finding);

        expect(findings.size()).toBe(1);
        expect(findings.isEmpty()).toBe(false);
        expect(findings.all()[0]).toBe(finding);
    });

    it("addMany() appends every entry from an iterable", () => {
        expect.assertions(2);

        const findings = new MarshallFindings();

        findings.addMany([errorFinding(), warningFinding(), warningFinding({ packageName: "demo2" })]);

        expect(findings.size()).toBe(3);
        expect(findings.all().map((entry) => entry.packageName)).toStrictEqual(["demo", "demo", "demo2"]);
    });

    it("errors() and warnings() filter by severity", () => {
        expect.assertions(2);

        const findings = new MarshallFindings();
        const error = errorFinding();
        const warning = warningFinding();

        findings.addMany([error, warning]);

        expect(findings.errors()).toStrictEqual([error]);
        expect(findings.warnings()).toStrictEqual([warning]);
    });

    it("hasErrors() / hasWarnings() report the current state", () => {
        expect.assertions(4);

        const findings = new MarshallFindings();

        findings.add(warningFinding());

        expect(findings.hasErrors()).toBe(false);
        expect(findings.hasWarnings()).toBe(true);

        findings.add(errorFinding());

        expect(findings.hasErrors()).toBe(true);
        expect(findings.hasWarnings()).toBe(true);
    });

    it("all() returns a snapshot that callers should treat as read-only", () => {
        expect.assertions(1);

        const findings = new MarshallFindings();

        findings.add(errorFinding());

        // The contract is "readonly"; verify the runtime array reflects the entries.
        // Mutating the underlying state is intentionally not exercised here — the
        // type system already forbids it at compile time.
        expect(findings.all()).toHaveLength(1);
    });
});

describe(formatMarshallFindingsAsTable, () => {
    it("returns an empty array when there are no findings", () => {
        expect.assertions(1);

        expect(formatMarshallFindingsAsTable([])).toStrictEqual([]);
    });

    it("renders errors first then warnings, separated by a blank line", () => {
        expect.assertions(4);

        const lines = formatMarshallFindingsAsTable([
            errorFinding({ message: "publisher email unverified" }),
            warningFinding({ message: "few weekly downloads" }),
        ]);

        // Header lines, body lines, and exactly one blank-line separator.
        expect(lines).toHaveLength(5);
        expect(lines[0]).toContain("1 error");
        expect(lines[2]).toBe("");
        expect(lines[3]).toContain("1 warning");
    });

    it("uses singular 'error' / 'warning' for exactly one finding", () => {
        expect.assertions(2);

        const errorOnly = formatMarshallFindingsAsTable([errorFinding()]);
        const warningOnly = formatMarshallFindingsAsTable([warningFinding()]);

        expect(errorOnly[0]).toContain("1 error:");
        expect(warningOnly[0]).toContain("1 warning:");
    });

    it("uses plural 'errors' / 'warnings' for >1 findings", () => {
        expect.assertions(2);

        const errors = formatMarshallFindingsAsTable([errorFinding(), errorFinding({ packageName: "two" })]);
        const warnings = formatMarshallFindingsAsTable([warningFinding(), warningFinding({ packageName: "two" })]);

        expect(errors[0]).toContain("2 errors:");
        expect(warnings[0]).toContain("2 warnings:");
    });

    it("includes the marshall name, package name and message on each row", () => {
        expect.assertions(3);

        const lines = formatMarshallFindingsAsTable([errorFinding({ marshall: "newBin", message: "adds new bin entry", packageName: "lefthook" })]);

        expect(lines[1]).toContain("[newBin]");
        expect(lines[1]).toContain("lefthook");
        expect(lines[1]).toContain("adds new bin entry");
    });

    it("emits an indented continuation row for suggestedAction", () => {
        expect.assertions(2);

        const lines = formatMarshallFindingsAsTable([
            errorFinding({ suggestedAction: "Add 'demo' to security.author.allowlist." }),
        ]);

        // header + finding + suggestion = 3 lines
        expect(lines).toHaveLength(3);
        expect(lines[2]).toContain("Add 'demo' to security.author.allowlist.");
    });

    it("omits the warnings header when only errors are present", () => {
        expect.assertions(1);

        const lines = formatMarshallFindingsAsTable([errorFinding()]);

        expect(lines.some((line) => line.includes("warning"))).toBe(false);
    });

    it("omits the errors header when only warnings are present", () => {
        expect.assertions(2);

        const lines = formatMarshallFindingsAsTable([warningFinding()]);

        expect(lines.some((line) => line.includes("error"))).toBe(false);
        // No leading blank-line separator either.
        expect(lines[0]).not.toBe("");
    });
});

describe(formatMarshallFindingsAsJson, () => {
    it("groups by severity and includes summary counts", () => {
        expect.assertions(4);

        const error = errorFinding();
        const warning = warningFinding();

        const json = formatMarshallFindingsAsJson([error, warning]);

        expect(json.findings).toStrictEqual([error, warning]);
        expect(json.errors).toStrictEqual([error]);
        expect(json.warnings).toStrictEqual([warning]);
        expect(json.summary).toStrictEqual({ errorCount: 1, warningCount: 1 });
    });

    it("returns zero-count summary for an empty list", () => {
        expect.assertions(2);

        const json = formatMarshallFindingsAsJson([]);

        expect(json.findings).toStrictEqual([]);
        expect(json.summary).toStrictEqual({ errorCount: 0, warningCount: 0 });
    });

    it("the returned findings array is a fresh copy, not the input reference", () => {
        expect.assertions(1);

        const input: MarshallFinding[] = [errorFinding()];
        const json = formatMarshallFindingsAsJson(input);

        expect(json.findings).not.toBe(input);
    });
});
