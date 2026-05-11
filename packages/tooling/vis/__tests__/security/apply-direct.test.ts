import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildDirectApplyPlan, formatDirectApplyPlan } from "../../src/security/apply-direct";

const writePkg = (path: string, contents: Record<string, unknown>): void => {
    writeFileSync(path, JSON.stringify(contents, undefined, 2));
};

describe(buildDirectApplyPlan, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-apply-direct-"));
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("classifies an in-range fix into apply", () => {
        expect.assertions(2);

        writePkg(join(workspace, "package.json"), {
            dependencies: { lodash: "^4.17.0" },
            name: "ws",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(1);
        expect(plan.apply[0]).toMatchObject({
            currentRange: "^4.17.0",
            field: "dependencies",
            inRange: true,
            packageName: "lodash",
            targetSpec: "^4.17.21",
            targetVersion: "4.17.21",
        });
    });

    it("classifies a major bump into skippedMajor by default", () => {
        expect.assertions(2);

        writePkg(join(workspace, "package.json"), {
            dependencies: { lodash: "^3.10.0" },
            name: "ws",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(0);
        expect(plan.skippedMajor[0]).toMatchObject({ inRange: false, packageName: "lodash" });
    });

    it("promotes a major bump to apply when allowMajor=true", () => {
        expect.assertions(2);

        writePkg(join(workspace, "package.json"), {
            dependencies: { lodash: "^3.10.0" },
            name: "ws",
        });

        const plan = buildDirectApplyPlan({
            allowMajor: true,
            findings: [{ packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(1);
        expect(plan.skippedMajor).toHaveLength(0);
    });

    it("marks a finding as transitive-only when no manifest declares it", () => {
        expect.assertions(1);

        writePkg(join(workspace, "package.json"), { dependencies: {}, name: "ws" });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.unmatched).toStrictEqual([{ packageName: "lodash", reason: "transitive-only" }]);
    });

    it("marks findings without a fixed version", () => {
        expect.assertions(1);

        writePkg(join(workspace, "package.json"), {
            dependencies: { lodash: "^4.17.0" },
            name: "ws",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "lodash", vulnerability: { fixedVersions: [] } }],
            workspaceRoot: workspace,
        });

        expect(plan.unmatched).toStrictEqual([{ packageName: "lodash", reason: "no-fixed-version" }]);
    });

    it("walks workspace packages declared via the workspaces field", () => {
        expect.assertions(2);

        writePkg(join(workspace, "package.json"), { name: "root", workspaces: ["packages/*"] });
        mkdirSync(join(workspace, "packages", "a"), { recursive: true });
        writePkg(join(workspace, "packages", "a", "package.json"), {
            dependencies: { axios: "^1.0.0" },
            name: "@scope/a",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "axios", vulnerability: { fixedVersions: ["1.6.0"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(1);
        expect(plan.apply[0]?.workspaceName).toBe("@scope/a");
    });

    it("walks workspace packages declared via pnpm-workspace.yaml", () => {
        expect.assertions(2);

        writePkg(join(workspace, "package.json"), { name: "root" });
        writeFileSync(join(workspace, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        mkdirSync(join(workspace, "packages", "b"), { recursive: true });
        writePkg(join(workspace, "packages", "b", "package.json"), {
            devDependencies: { axios: "^1.0.0" },
            name: "@scope/b",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "axios", vulnerability: { fixedVersions: ["1.6.0"] } }],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(1);
        expect(plan.apply[0]?.field).toBe("devDependencies");
    });

    it("collapses duplicate fixes by manifest+field+package+version", () => {
        expect.assertions(1);

        writePkg(join(workspace, "package.json"), {
            dependencies: { lodash: "^4.17.0" },
            name: "ws",
        });

        // Two findings for the same package with the same lowest fix → one entry
        const plan = buildDirectApplyPlan({
            findings: [
                { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } },
                { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } },
            ],
            workspaceRoot: workspace,
        });

        expect(plan.apply).toHaveLength(1);
    });

    it("tolerates non-semver ranges (workspace:, file:, …)", () => {
        expect.assertions(1);

        writePkg(join(workspace, "package.json"), {
            dependencies: { "internal-pkg": "workspace:*" },
            name: "ws",
        });

        const plan = buildDirectApplyPlan({
            findings: [{ packageName: "internal-pkg", vulnerability: { fixedVersions: ["2.0.0"] } }],
            workspaceRoot: workspace,
        });

        // workspace:* falls into the "conservatively in-range" branch
        expect(plan.apply).toHaveLength(1);
    });
});

describe(formatDirectApplyPlan, () => {
    it("renders apply + skipped + transitive sections", () => {
        expect.assertions(3);

        const formatted = formatDirectApplyPlan({
            apply: [
                {
                    currentRange: "^1.0.0",
                    field: "dependencies",
                    inRange: true,
                    manifestPath: "/x/package.json",
                    packageName: "axios",
                    targetSpec: "^1.6.0",
                    targetVersion: "1.6.0",
                },
            ],
            skippedMajor: [
                {
                    currentRange: "^3.10.0",
                    field: "dependencies",
                    inRange: false,
                    manifestPath: "/x/package.json",
                    packageName: "lodash",
                    targetSpec: "^4.17.21",
                    targetVersion: "4.17.21",
                },
            ],
            unmatched: [
                { packageName: "vary", reason: "transitive-only" },
                { packageName: "stuck", reason: "no-fixed-version" },
            ],
        });

        expect(formatted).toContain("Apply (1):");
        expect(formatted).toContain("--allow-major");
        expect(formatted).toContain("--apply-transitive");
    });

    it("returns a no-op message for empty plans", () => {
        expect.assertions(1);

        const formatted = formatDirectApplyPlan({ apply: [], skippedMajor: [], unmatched: [] });

        expect(formatted).toBe("No direct-dep fixes to apply.");
    });
});
