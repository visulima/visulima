import { writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyAubeParanoidOverrides, readAubeSecurityPosture } from "../../src/util/aube-config";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe(readAubeSecurityPosture, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-aube-config-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("returns an empty posture when no workspace yaml exists", () => {
        expect.assertions(2);

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.source).toBeUndefined();
        expect(posture.paranoid).toBeUndefined();
    });

    it("reads aube-workspace.yaml in preference to pnpm-workspace.yaml", () => {
        expect.assertions(3);

        writeFileSync(join(workspaceRoot, "aube-workspace.yaml"), "paranoid: true\ntrustPolicy: no-downgrade\n");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "paranoid: false\n");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.source).toBe("aube-workspace.yaml");
        expect(posture.paranoid).toBe(true);
        expect(posture.trustPolicy).toBe("no-downgrade");
    });

    it("falls back to pnpm-workspace.yaml when aube-workspace.yaml is absent", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "jailBuilds: true\nminimumReleaseAge: 4320\n");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.source).toBe("pnpm-workspace.yaml");
        expect(posture.jailBuilds).toBe(true);
    });

    it("returns the default posture when YAML is malformed", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "aube-workspace.yaml"), "::: not yaml :::");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.source).toBeUndefined();
    });

    it("counts allowBuilds entries", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "aube-workspace.yaml"), "allowBuilds:\n  esbuild: true\n  sharp: true\n  '@prisma/client': false\n");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.allowBuildsCount).toBe(3);
    });

    it("ignores non-numeric minimumReleaseAge values", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "aube-workspace.yaml"), "minimumReleaseAge: '4320'\n");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.minimumReleaseAge).toBeUndefined();
    });

    it("ignores trustPolicy values outside the documented enum", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "aube-workspace.yaml"), "trustPolicy: weird\n");

        const posture = readAubeSecurityPosture(workspaceRoot);

        expect(posture.trustPolicy).toBeUndefined();
    });
});

describe(applyAubeParanoidOverrides, () => {
    it("forces the strict bundle on when paranoid is true", () => {
        expect.assertions(4);

        const result = applyAubeParanoidOverrides({
            allowBuildsCount: 0,
            blockExoticSubdeps: undefined,
            jailBuilds: false,
            minimumReleaseAge: undefined,
            minimumReleaseAgeStrict: false,
            paranoid: true,
            source: "aube-workspace.yaml",
            strictDepBuilds: false,
            trustPolicy: "off",
        });

        // paranoid overrides explicit `off` for trustPolicy.
        expect(result.trustPolicy).toBe("no-downgrade");
        expect(result.jailBuilds).toBe(true);
        expect(result.minimumReleaseAgeStrict).toBe(true);
        expect(result.strictDepBuilds).toBe(true);
    });

    it("returns the input unchanged when paranoid is unset or false", () => {
        expect.assertions(2);

        const input = {
            allowBuildsCount: 0,
            blockExoticSubdeps: undefined,
            jailBuilds: false,
            minimumReleaseAge: undefined,
            minimumReleaseAgeStrict: undefined,
            paranoid: false,
            source: undefined,
            strictDepBuilds: undefined,
            trustPolicy: "off" as const,
        };

        const result = applyAubeParanoidOverrides(input);

        expect(result).toStrictEqual(input);
        expect(result.trustPolicy).toBe("off");
    });
});
