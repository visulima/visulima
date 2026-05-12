import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VisConfig } from "../../src/config/workspace";
import { checkPmNativeConfigDrift, formatDriftReport } from "../../src/security/security";

interface LegacySecurityShape {
    allowBuilds?: Record<string, boolean>;
    minimumReleaseAge?: number;
    minimumReleaseAgeExclude?: string[];
}

const cfg = (security: LegacySecurityShape): VisConfig => {
    const { allowBuilds, minimumReleaseAge, minimumReleaseAgeExclude } = security;
    const installScripts = allowBuilds === undefined ? undefined : { allow: allowBuilds };
    const firstSeen
        = minimumReleaseAge === undefined && minimumReleaseAgeExclude === undefined
            ? undefined
            : {
                ...(minimumReleaseAge === undefined ? {} : { minutes: minimumReleaseAge }),
                ...(minimumReleaseAgeExclude === undefined ? {} : { exclude: minimumReleaseAgeExclude }),
            };
    const policies
        = installScripts === undefined && firstSeen === undefined
            ? undefined
            : {
                ...(installScripts === undefined ? {} : { installScripts: installScripts }),
                ...(firstSeen === undefined ? {} : { firstSeen: firstSeen }),
            };

    return { security: { ...(policies === undefined ? {} : { policies }) } } satisfies VisConfig;
};

describe(checkPmNativeConfigDrift, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-drift-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    describe("no drift", () => {
        it("reports no drift when vis-config has nothing to compare", () => {
            expect.assertions(2);

            const report = checkPmNativeConfigDrift(cfg({}), "pnpm", tmpDir);

            expect(report.hasDrift).toBe(false);
            expect(formatDriftReport(report)).toStrictEqual([]);
        });

        it("ignores PM-side values when vis.config does not set them", () => {
            expect.assertions(1);

            // PM has values but vis doesn't — vis treats this as "no opinion".
            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "minimumReleaseAge: 1440\n");

            expect(checkPmNativeConfigDrift(cfg({}), "pnpm", tmpDir).hasDrift).toBe(false);
        });

        it("matches identical values", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "minimumReleaseAge: 2880\nallowBuilds:\n  esbuild: true\n");

            const report = checkPmNativeConfigDrift(cfg({ allowBuilds: { esbuild: true }, minimumReleaseAge: 2880 }), "pnpm", tmpDir);

            expect(report.hasDrift).toBe(false);
        });
    });

    describe("pnpm drift", () => {
        it("flags an allowBuilds entry that is only in vis", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "allowBuilds:\n  esbuild: true\n");

            const report = checkPmNativeConfigDrift(cfg({ allowBuilds: { esbuild: true, sharp: true } }), "pnpm", tmpDir);

            expect(report.hasDrift).toBe(true);
            expect(report.allowBuilds?.onlyInVis).toStrictEqual(["sharp"]);
        });

        it("flags an allowBuilds entry that is only in the PM config", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "allowBuilds:\n  esbuild: true\n  sharp: true\n");

            const report = checkPmNativeConfigDrift(cfg({ allowBuilds: { esbuild: true } }), "pnpm", tmpDir);

            expect(report.allowBuilds?.onlyInPm).toStrictEqual(["sharp"]);
        });

        it("falls back to onlyBuiltDependencies (pnpm v10) when allowBuilds map is absent", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "onlyBuiltDependencies:\n  - esbuild\n  - sharp\n");

            const report = checkPmNativeConfigDrift(cfg({ allowBuilds: { esbuild: true } }), "pnpm", tmpDir);

            expect(report.allowBuilds?.onlyInPm).toStrictEqual(["sharp"]);
        });

        it("flags a minimumReleaseAge mismatch", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "minimumReleaseAge: 1440\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "pnpm", tmpDir);

            expect(report.minReleaseAge).toStrictEqual({ pm: 1440, vis: 2880 });
            expect(report.hasDrift).toBe(true);
        });

        it("flags minReleaseAge as drifted when vis has a value but pnpm-workspace.yaml is absent", () => {
            expect.assertions(1);

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "pnpm", tmpDir);

            expect(report.minReleaseAge).toStrictEqual({ pm: undefined, vis: 2880 });
        });
    });

    describe("bun drift", () => {
        it("flags a trustedDependencies entry only in vis", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ trustedDependencies: ["esbuild"] }));

            const report = checkPmNativeConfigDrift(cfg({ allowBuilds: { esbuild: true, sharp: true } }), "bun", tmpDir);

            expect(report.allowBuilds?.onlyInVis).toStrictEqual(["sharp"]);
        });

        it("converts bun seconds to minutes before comparing", () => {
            expect.assertions(1);

            // 172800 seconds = 2880 minutes — should match exactly.
            writeFileSync(join(tmpDir, "bunfig.toml"), "[install]\nminimumReleaseAge = 172800\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "bun", tmpDir);

            expect(report.hasDrift).toBe(false);
        });
    });

    describe("npm drift", () => {
        it("parses .npmrc duration strings (e.g. '2d') before comparing", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "min-release-age=2d\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "npm", tmpDir);

            expect(report.hasDrift).toBe(false);
        });

        it("flags mismatch on .npmrc time-string drift", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "min-release-age=24h\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "npm", tmpDir);

            // 24h = 1440 minutes; vis wants 2880.
            expect(report.minReleaseAge).toStrictEqual({ pm: 1440, vis: 2880 });
        });
    });

    describe("yarn classic", () => {
        it("does not flag drift when .yarnrc.yml is absent (yarn classic — no native field)", () => {
            expect.assertions(1);

            // No .yarnrc.yml exists → vis must not report drift.
            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "yarn", tmpDir);

            expect(report.hasDrift).toBe(false);
        });

        it("flags drift on yarn berry when .yarnrc.yml has a different value", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "npmMinimalAgeGate: \"24h\"\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880 }), "yarn", tmpDir);

            expect(report.minReleaseAge).toStrictEqual({ pm: 1440, vis: 2880 });
        });
    });

    describe("excludes drift", () => {
        it("flags minimumReleaseAgeExclude differences for pnpm", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "minimumReleaseAge: 2880\nminimumReleaseAgeExclude:\n  - typescript\n");

            const report = checkPmNativeConfigDrift(cfg({ minimumReleaseAge: 2880, minimumReleaseAgeExclude: ["typescript", "@types/node"] }), "pnpm", tmpDir);

            expect(report.minReleaseAgeExcludes?.onlyInVis).toStrictEqual(["@types/node"]);
            expect(report.hasDrift).toBe(true);
        });
    });
});

describe(formatDriftReport, () => {
    it("returns an empty array when there is no drift", () => {
        expect.assertions(1);

        expect(formatDriftReport({ hasDrift: false, packageManager: "pnpm" })).toStrictEqual([]);
    });

    it("renders allowBuilds drift on both sides", () => {
        expect.assertions(2);

        const lines = formatDriftReport({
            allowBuilds: { onlyInPm: ["only-in-pm"], onlyInVis: ["only-in-vis"] },
            hasDrift: true,
            packageManager: "pnpm",
        });

        expect(lines.some((l) => l.includes("only in vis.config: only-in-vis"))).toBe(true);
        expect(lines.some((l) => l.includes("only in pnpm config: only-in-pm"))).toBe(true);
    });

    it("renders a remediation hint mentioning 'vis security sync'", () => {
        expect.assertions(1);

        const lines = formatDriftReport({
            hasDrift: true,
            minReleaseAge: { pm: 1440, vis: 2880 },
            packageManager: "npm",
        });

        expect(lines.at(-1)).toContain("vis security sync");
    });

    it("labels unset values as 'unset' rather than omitting them", () => {
        expect.assertions(1);

        const lines = formatDriftReport({
            hasDrift: true,
            minReleaseAge: { pm: undefined, vis: 2880 },
            packageManager: "pnpm",
        });

        expect(lines.some((l) => l.includes("unset"))).toBe(true);
    });
});
