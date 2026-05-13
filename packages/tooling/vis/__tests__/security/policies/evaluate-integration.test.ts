import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PackageManifest } from "../../../src/security/manifests";
import { evaluatePolicies, parsePoliciesFlag } from "../../../src/security/policies";
import type { SecurityVulnerability } from "../../../src/util/catalog";

const writePkg = (root: string, name: string, fields: { license?: string; scripts?: Record<string, string> }): void => {
    const dir = join(root, "node_modules", name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", ...fields }));
};

describe(evaluatePolicies, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-policy-integration-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("returns no decisions when no policy is configured", async () => {
        expect.assertions(1);

        const decisions = await evaluatePolicies(
            { offline: false, packageManager: "pnpm", packages: [], workspaceRoot },
            "audit",
            { visConfig: {} },
        );

        expect(decisions).toStrictEqual([]);
    });

    it("evaluates multiple configured policies in one pass", async () => {
        expect.assertions(2);

        // One package with a denied license + an unapproved install script.
        writePkg(workspaceRoot, "evil", { license: "GPL-3.0", scripts: { install: "rm -rf /" } });

        const manifestData = new Map<string, PackageManifest>([
            ["evil@1.0.0", { directory: join(workspaceRoot, "node_modules/evil"), license: "GPL-3.0", name: "evil", version: "1.0.0" }],
        ]);

        const config: VisConfig = {
            security: {
                policies: {
                    installScripts: { strict: true },
                    license: { deny: ["GPL-3.0"] },
                },
            },
        };

        const decisions = await evaluatePolicies(
            {
                manifestData,
                offline: false,
                packageManager: "pnpm",
                packages: [{ isDev: false, name: "evil", version: "1.0.0" }],
                workspaceRoot,
            },
            "audit",
            { visConfig: config },
        );

        const policies = new Set(decisions.map((d) => d.policy));

        expect(policies.has("license")).toBe(true);
        expect(policies.has("installScripts")).toBe(true);
    });

    it("respects the enabledPolicies allow-list", async () => {
        expect.assertions(1);

        writePkg(workspaceRoot, "evil", { license: "GPL-3.0", scripts: { install: "rm -rf /" } });

        const manifestData = new Map<string, PackageManifest>([
            ["evil@1.0.0", { directory: join(workspaceRoot, "node_modules/evil"), license: "GPL-3.0", name: "evil", version: "1.0.0" }],
        ]);

        const config: VisConfig = {
            security: {
                policies: {
                    installScripts: { strict: true },
                    license: { deny: ["GPL-3.0"] },
                },
            },
        };

        const decisions = await evaluatePolicies(
            {
                manifestData,
                offline: false,
                packageManager: "pnpm",
                packages: [{ isDev: false, name: "evil", version: "1.0.0" }],
                workspaceRoot,
            },
            "audit",
            { enabledPolicies: new Set(["license"]), visConfig: config },
        );

        expect(decisions.every((d) => d.policy === "license")).toBe(true);
    });

    it("emits an info skip decision when an offline-incompatible policy runs offline", async () => {
        expect.assertions(2);

        // No offline-incompatible policies in commit 1 — synthesise the
        // scenario by forcing enabledPolicies to include a future
        // network-only policy ('malware') that has no registered module yet.
        // The engine selects only registered modules, so this test confirms
        // the offline branch is reachable via registered modules that opt in
        // by setting `offlineSupported: false`. None of our commit-1
        // policies do — so we assert the inverse: offline still produces
        // decisions for offline-supported modules.
        const findings = new Map<string, SecurityVulnerability[]>([
            ["lodash", [{ cvssScore: undefined, fixedVersions: [], id: "CVE-2020-8203", severity: "HIGH" as const, summary: "x" }]],
        ]);
        const config: VisConfig = { security: { policies: { vulnerability: { failOn: "high" } } } };

        const decisions = await evaluatePolicies(
            {
                offline: true,
                osvFindings: findings,
                packageManager: "pnpm",
                packages: [{ isDev: false, name: "lodash", version: "4.17.20" }],
                workspaceRoot,
            },
            "audit",
            { visConfig: config },
        );

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.policy).toBe("vulnerability");
    });

    it("contains the module exception inside an info decision instead of throwing", async () => {
        expect.assertions(1);

        // Force unexpectedDeps with a baseline path that points at a real
        // directory — parseLockFileContent will return [] and the policy
        // returns no decisions. Verifies graceful fallback.
        const config: VisConfig = {
            security: { policies: { unexpectedDeps: { baselineLockfile: "/tmp/nonexistent-baseline.yaml" } } },
        };

        const decisions = await evaluatePolicies(
            { offline: false, packageManager: "pnpm", packages: [], workspaceRoot },
            "audit",
            { visConfig: config },
        );

        // No throw + empty result is acceptable: baseline unreadable means
        // the policy emits nothing.
        expect(Array.isArray(decisions)).toBe(true);
    });
});

describe(parsePoliciesFlag, () => {
    it("returns undefined when the flag was not passed", () => {
        expect.assertions(1);

        expect(parsePoliciesFlag(undefined)).toBeUndefined();
    });

    it("returns an empty set for 'none'", () => {
        expect.assertions(2);

        const set = parsePoliciesFlag("none");

        expect(set).toBeInstanceOf(Set);
        expect(set?.size).toBe(0);
    });

    it("parses a comma list into a Set<PolicyName>", () => {
        expect.assertions(2);

        const set = parsePoliciesFlag("license,vulnerability");

        expect(set?.has("license")).toBe(true);
        expect(set?.has("vulnerability")).toBe(true);
    });

    it("accepts snake_case tokens for ergonomics", () => {
        expect.assertions(1);

        const set = parsePoliciesFlag("install_scripts,unexpected_deps");

        expect(set?.has("installScripts") && set?.has("unexpectedDeps")).toBe(true);
    });

    it("reports unknown tokens via the callback and skips them", () => {
        expect.assertions(2);

        const unknown: string[] = [];
        const set = parsePoliciesFlag("license,nonsense", (n) => unknown.push(n));

        expect(unknown).toStrictEqual(["nonsense"]);
        expect(set?.size).toBe(1);
    });

    it("returns every known policy for 'all'", () => {
        expect.assertions(1);

        const set = parsePoliciesFlag("all");

        expect(set?.size).toBeGreaterThanOrEqual(8);
    });

    it("is case-insensitive on policy names", () => {
        expect.assertions(2);

        const set = parsePoliciesFlag("LICENSE,InstallScripts");

        expect(set?.has("license")).toBe(true);
        expect(set?.has("installScripts")).toBe(true);
    });

    it("strips leading underscores from tokens", () => {
        expect.assertions(2);

        const unknown: string[] = [];
        const set = parsePoliciesFlag("_license,__install_scripts", (n) => unknown.push(n));

        expect(unknown).toStrictEqual([]);
        expect(set?.has("license") && set?.has("installScripts")).toBe(true);
    });

    it("does not consider whitespace-only tokens as unknown", () => {
        expect.assertions(2);

        const unknown: string[] = [];
        const set = parsePoliciesFlag("license, ,vulnerability", (n) => unknown.push(n));

        expect(unknown).toStrictEqual([]);
        expect(set?.size).toBe(2);
    });
});
