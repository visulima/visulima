import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * Two crates in one workspace share a single root Cargo.lock and are both
 * released in the same wave. Each release used to rewrite the lockfile from
 * its original content, so the last write won and one bump was lost.
 */
describe.skipIf(process.platform === "win32")("orchestrator: Cargo.lock shared by two released crates", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-orch-lock-"));

        writeFileSync(join(cwd, "package.json"), `${JSON.stringify({ name: "root", private: true, version: "0.0.0", workspaces: ["packages/*"] }, null, 4)}\n`);
        writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(
            join(cwd, "Cargo.lock"),
            [
                "version = 4",
                "",
                "[[package]]",
                "name = \"a\"",
                "version = \"1.0.0\"",
                "",
                "[[package]]",
                "name = \"b\"",
                "version = \"1.0.0\"",
                "",
            ].join("\n"),
        );

        for (const name of ["a", "b"]) {
            const dir = join(cwd, "packages", name);

            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name, version: "1.0.0" }, null, 4)}\n`);
            writeFileSync(join(dir, "Cargo.toml"), `[package]\nname = "${name}"\nversion = "1.0.0"\n`);
        }

        mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(cwd, ".vis", "release", "x.md"), "---\na: minor\nb: minor\n---\n### Both\n\nBody\n");
        writeFileSync(
            join(cwd, "vis.config.cjs"),
            `module.exports = { release: { acknowledgeUnstable: true, defaultManaged: true, packages: { a: { versionFiles: ["Cargo.toml"] }, b: { versionFiles: ["Cargo.toml"] } } } };\n`,
        );
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("lands both lockfile bumps, not just the last release's", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => r.name).sort()).toStrictEqual(["a", "b"]);

        await applyContext(ctx, { dryRun: false });

        const lock = readFileSync(join(cwd, "Cargo.lock"), "utf8");

        expect(lock).toContain("name = \"a\"\nversion = \"1.1.0\"");
        expect(lock).toContain("name = \"b\"\nversion = \"1.1.0\"");
    });
});
