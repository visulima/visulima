import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import {
    applyOverridePlan,
    buildOverridePlanFromFindings,
    planOverrideWrite,
    resolveOverrideSurface,
} from "../../src/security/transitive-fix";

describe(buildOverridePlanFromFindings, () => {
    it("emits caret-pinned overrides per vulnerable package", () => {
        expect.assertions(1);

        const plan = buildOverridePlanFromFindings([
            { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21", "5.0.0"] } },
            { packageName: "axios", vulnerability: { fixedVersions: ["1.6.0"] } },
        ]);

        expect(plan.entries).toStrictEqual([
            { packageName: "axios", spec: "^1.6.0" },
            { packageName: "lodash", spec: "^4.17.21" },
        ]);
    });

    it("skips findings without a fixed version", () => {
        expect.assertions(1);

        const plan = buildOverridePlanFromFindings([
            { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } },
            { packageName: "stuck", vulnerability: { fixedVersions: [] } },
        ]);

        expect(plan.entries.map((e) => e.packageName)).toStrictEqual(["lodash"]);
    });

    it("collapses duplicate package names — last finding wins", () => {
        expect.assertions(1);

        const plan = buildOverridePlanFromFindings([
            { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.20"] } },
            { packageName: "lodash", vulnerability: { fixedVersions: ["4.17.21"] } },
        ]);

        expect(plan.entries).toStrictEqual([{ packageName: "lodash", spec: "^4.17.21" }]);
    });
});

describe(resolveOverrideSurface, () => {
    it("targets pnpm-workspace.yaml for pnpm v10+", () => {
        expect.assertions(1);

        const result = resolveOverrideSurface("/ws", { name: "pnpm", version: "10.0.0" });

        expect(result.surface).toBe("pnpm-workspace.yaml");
    });

    it("targets package.json#pnpm.overrides for pnpm v9", () => {
        expect.assertions(1);

        const result = resolveOverrideSurface("/ws", { name: "pnpm", version: "9.15.0" });

        expect(result.surface).toBe("package.json#pnpm.overrides");
    });

    it("targets package.json#resolutions for yarn", () => {
        expect.assertions(1);

        const result = resolveOverrideSurface("/ws", { name: "yarn", version: "4.0.0" });

        expect(result.surface).toBe("package.json#resolutions");
    });

    it("targets package.json#overrides for npm and bun", () => {
        expect.assertions(2);

        expect(resolveOverrideSurface("/ws", { name: "npm", version: "10.0.0" }).surface).toBe("package.json#overrides");
        expect(resolveOverrideSurface("/ws", { name: "bun", version: "1.3.0" }).surface).toBe("package.json#overrides");
    });
});

describe(planOverrideWrite, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-tfix-"));
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("merges new pnpm overrides with existing ones, sorted by key", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspace, "pnpm-workspace.yaml"),
            "packages:\n  - 'packages/*'\n\noverrides:\n  'older-pkg': '^1.0.0'\n",
        );

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "lodash", spec: "^4.17.21" }] },
            { name: "pnpm", version: "10.0.0" },
        );

        const parsed = parseYaml(plan.nextContent) as { overrides: Record<string, string>; packages: string[] };

        expect(Object.keys(parsed.overrides)).toStrictEqual(["lodash", "older-pkg"]);
        expect(parsed.packages).toStrictEqual(["packages/*"]);
    });

    it("writes npm overrides into package.json#overrides", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspace, "package.json"),
            JSON.stringify({ dependencies: {}, name: "ws", version: "1.0.0" }, undefined, 2),
        );

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "npm", version: "10.0.0" },
        );

        const parsed = JSON.parse(plan.nextContent) as Record<string, unknown>;

        expect(parsed.overrides).toStrictEqual({ axios: "^1.6.0" });
    });

    it("writes yarn resolutions into package.json#resolutions", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "ws" }, undefined, 2));

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "yarn", version: "4.0.0" },
        );

        const parsed = JSON.parse(plan.nextContent) as Record<string, unknown>;

        expect(parsed.resolutions).toStrictEqual({ axios: "^1.6.0" });
    });

    it("writes pnpm v9 overrides into package.json#pnpm.overrides", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "ws" }, undefined, 2));

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "pnpm", version: "9.15.0" },
        );

        const parsed = JSON.parse(plan.nextContent) as { pnpm: { overrides: Record<string, string> } };

        expect(parsed.pnpm.overrides).toStrictEqual({ axios: "^1.6.0" });
    });

    it("classifies each entry as added / updated / unchanged", () => {
        expect.assertions(3);

        writeFileSync(
            join(workspace, "package.json"),
            JSON.stringify(
                { name: "ws", overrides: { lodash: "^4.17.21", "stays-the-same": "^1.0.0" } },
                undefined,
                2,
            ),
        );

        const plan = planOverrideWrite(
            workspace,
            {
                entries: [
                    { packageName: "lodash", spec: "^4.17.22" },
                    { packageName: "axios", spec: "^1.6.0" },
                    { packageName: "stays-the-same", spec: "^1.0.0" },
                ],
            },
            { name: "npm", version: "10.0.0" },
        );

        expect(plan.entries.find((e) => e.packageName === "axios")?.status).toBe("added");
        expect(plan.entries.find((e) => e.packageName === "lodash")?.status).toBe("updated");
        expect(plan.entries.find((e) => e.packageName === "stays-the-same")?.status).toBe("unchanged");
    });

    it("reports changed=false when every entry was unchanged", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspace, "package.json"),
            JSON.stringify({ name: "ws", overrides: { axios: "^1.6.0" } }, undefined, 2),
        );

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "npm", version: "10.0.0" },
        );

        expect(plan.changed).toBe(false);
    });

    it("produces a deterministic diff across runs (sorted keys)", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "ws" }, undefined, 2));

        const planA = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "z-pkg", spec: "^1" }, { packageName: "a-pkg", spec: "^1" }] },
            { name: "npm", version: "10.0.0" },
        );

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "ws" }, undefined, 2));

        const planB = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "a-pkg", spec: "^1" }, { packageName: "z-pkg", spec: "^1" }] },
            { name: "npm", version: "10.0.0" },
        );

        expect(planA.nextContent).toBe(planB.nextContent);
    });
});

describe(applyOverridePlan, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-tfix-apply-"));
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("writes the override file atomically and leaves no .tmp behind", () => {
        expect.assertions(2);

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "ws" }, undefined, 2));

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "npm", version: "10.0.0" },
        );

        applyOverridePlan(plan);

        const pkg = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8")) as Record<string, unknown>;

        expect(pkg.overrides).toStrictEqual({ axios: "^1.6.0" });
        expect(existsSync(join(workspace, "package.json.tmp"))).toBe(false);
    });

    it("is a no-op when nothing changed", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspace, "package.json"),
            JSON.stringify({ name: "ws", overrides: { axios: "^1.6.0" } }, undefined, 2),
        );

        const before = readFileSync(join(workspace, "package.json"), "utf8");

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "npm", version: "10.0.0" },
        );

        applyOverridePlan(plan);

        expect(readFileSync(join(workspace, "package.json"), "utf8")).toBe(before);
    });

    it("errors when applying pnpm v10+ overrides without a pnpm-workspace.yaml", () => {
        expect.assertions(1);

        const plan = planOverrideWrite(
            workspace,
            { entries: [{ packageName: "axios", spec: "^1.6.0" }] },
            { name: "pnpm", version: "10.0.0" },
        );

        expect(() => applyOverridePlan(plan)).toThrow(/pnpm-workspace\.yaml not found/);
    });
});
