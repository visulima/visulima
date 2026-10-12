import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with crate discovery on.
 * A bump of `a` must move `b`'s requirement on it, give `b` a patch bump, and
 * update Cargo.lock for both crates in one pass.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Cargo crate releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const writeConfig = (cargo: boolean): void => {
        write("vis.config.cjs", `module.exports = { release: { acknowledgeUnstable: true${cargo ? ", cargo: { discover: true }" : ""} } };\n`);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-crates-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("Cargo.toml", "[workspace]\nmembers = [\"crates/*\"]\n");
        write("Cargo.lock", "version = 4\n\n[[package]]\nname = \"a\"\nversion = \"0.1.0\"\n\n[[package]]\nname = \"b\"\nversion = \"0.1.0\"\ndependencies = [\n \"a\",\n]\n");
        write("crates/a/Cargo.toml", "[package]\nname = \"a\"\nversion = \"0.1.0\"\n");
        write("crates/b/Cargo.toml", "[package]\nname = \"b\"\nversion = \"0.1.0\"\n\n[dependencies]\na = { path = \"../a\", version = \"0.1.0\" }\n");
        write(".vis/release/x.md", "---\na: minor\n---\n### Minor a\n\nBody\n");
        write(".vis/release/x.md", "---\na: minor\n---\n### Minor a\n\nBody\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("moves the dependent's requirement, bumps it, and updates the lockfile", async () => {
        expect.hasAssertions();

        writeConfig(true);

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion]).sort()).toStrictEqual([
            ["a", "0.2.0"],
            ["b", "0.1.1"],
        ]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "crates", "a", "Cargo.toml"), "utf8")).toContain("version = \"0.2.0\"");
        expect(readFileSync(join(cwd, "crates", "b", "Cargo.toml"), "utf8")).toContain("version = \"0.1.1\"");
        expect(readFileSync(join(cwd, "crates", "b", "Cargo.toml"), "utf8")).toContain("a = { path = \"../a\", version = \"0.2.0\" }");

        const lock = readFileSync(join(cwd, "Cargo.lock"), "utf8");

        expect(lock).toContain("name = \"a\"\nversion = \"0.2.0\"");
        expect(lock).toContain("name = \"b\"\nversion = \"0.1.1\"");
    });

    it("discovers no crates unless release.cargo.discover is on", async () => {
        expect.hasAssertions();

        writeConfig(false);

        const ctx = await buildContext({ cwd });

        expect(ctx.packages.filter((pkg) => pkg.ecosystem === "cargo")).toStrictEqual([]);
    });

    it("rejects a partial release of an inherit group", async () => {
        expect.hasAssertions();

        write("Cargo.toml", "[workspace]\nmembers = [\"crates/*\"]\n\n[workspace.package]\nversion = \"1.0.0\"\n");
        write("crates/a/Cargo.toml", "[package]\nname = \"a\"\nversion.workspace = true\n");
        write("crates/b/Cargo.toml", "[package]\nname = \"b\"\nversion.workspace = true\n");
        write("Cargo.lock", "version = 4\n");
        writeConfig(true);

        const ctx = await buildContext({ cwd });

        await expect(applyContext(ctx, { dryRun: false })).rejects.toThrow(/must release together/);
    });
});
