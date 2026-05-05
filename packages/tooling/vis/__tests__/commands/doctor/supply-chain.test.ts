import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildSupplyChainPosture } from "../../../src/commands/doctor/supply-chain";
import type { VisConfig } from "../../../src/config/workspace";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const baseSecurity: VisConfig = {
    security: {
        allowBuilds: { esbuild: "^0.20.0" },
        blockExoticSubdeps: true,
        minimumReleaseAge: 1440,
        trustPolicy: "no-downgrade",
    },
};

describe(buildSupplyChainPosture, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-supply-chain-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("emits an error finding when a referenced patch file is missing", () => {
        expect.assertions(3);

        // Two entries — only one patch file exists on disk. The other
        // entry must surface as an `error` finding.
        writeFileSync(
            join(workspaceRoot, "package.json"),
            JSON.stringify(
                {
                    name: "root",
                    patchedDependencies: {
                        "ghost@2.0.0": "patches/missing.patch",
                        "lodash@4.17.21": "patches/lodash.patch",
                    },
                },
                undefined,
                2,
            ),
        );
        mkdirSync(join(workspaceRoot, "patches"), { recursive: true });
        writeFileSync(join(workspaceRoot, "patches", "lodash.patch"), "diff --git a/x b/x\n");

        const result = buildSupplyChainPosture(baseSecurity, { packageManager: "bun", workspaceRoot });

        const patchFinding = result.findings.find((finding) => finding.label.includes("missing patch file"));

        expect(patchFinding).toBeDefined();
        expect(patchFinding?.severity).toBe("error");
        // Section status must escalate to `error` because of the patch.
        expect(result.status).toBe("error");
    });

    it("emits an ok finding summarising entry count when every patch file resolves", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "package.json"),
            JSON.stringify({ name: "root", patchedDependencies: { "lodash@4.17.21": "patches/lodash.patch" } }, undefined, 2),
        );
        mkdirSync(join(workspaceRoot, "patches"), { recursive: true });
        writeFileSync(join(workspaceRoot, "patches", "lodash.patch"), "diff --git a/x b/x\n");

        const result = buildSupplyChainPosture(baseSecurity, { packageManager: "bun", workspaceRoot });

        const patchFinding = result.findings.find((finding) => finding.label.includes("patchedDependencies"));

        expect(patchFinding).toMatchObject({
            label: "patchedDependencies: 1 entry resolved",
            severity: "ok",
        });
        expect(result.status).toBe("ok");
    });

    it("does not emit any patch finding when no patches are configured", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }, undefined, 2));

        const result = buildSupplyChainPosture(baseSecurity, { packageManager: "bun", workspaceRoot });

        expect(result.findings.some((finding) => finding.label.includes("patchedDependencies"))).toBe(false);
    });

    it("does not emit any patch finding when context is omitted (legacy callers)", () => {
        expect.assertions(1);

        // Some downstream callers (tests, JSON output snapshots) pass
        // only the config. Patch validation must be opt-in via context
        // — silent no-op when workspaceRoot is missing.
        const result = buildSupplyChainPosture(baseSecurity);

        expect(result.findings.some((finding) => finding.label.includes("patchedDependencies"))).toBe(false);
    });
});
