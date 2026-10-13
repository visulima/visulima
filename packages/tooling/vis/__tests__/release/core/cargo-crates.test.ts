import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverCargoCrates, findInheritedWorkspaceVersion } from "../../../src/release/core/cargo-crates";

/**
 * Crate discovery from a root `[workspace].members`. The rules under test:
 * `exclude` wins, a JS-claimed crate is skipped, inherited versions resolve
 * from `[workspace.package]`, `publish = false` is private, and path
 * dependencies become graph edges keyed by the real package name.
 */
describe("cargo-crates: discoverCargoCrates", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-cargo-discover-")));

        write("Cargo.toml", "[workspace]\nmembers = [\"crates/*\"]\nexclude = [\"crates/skip\"]\n\n[workspace.package]\nversion = \"1.0.0\"\n");
        write("crates/a/Cargo.toml", "[package]\nname = \"a\"\nversion.workspace = true\n");
        write("crates/b/Cargo.toml", "[package]\nname = \"b\"\nversion = \"0.1.0\"\n\n[dependencies]\nalpha = { package = \"a\", path = \"../a\", version = \"1.0.0\" }\n");
        write("crates/c/Cargo.toml", "[package]\nname = \"c\"\nversion = \"0.1.0\"\npublish = false\n");
        write("crates/skip/Cargo.toml", "[package]\nname = \"skip\"\nversion = \"0.1.0\"\n");
        write("crates/claimed/Cargo.toml", "[package]\nname = \"claimed\"\nversion = \"0.1.0\"\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("discovers members, honours exclude, and skips JS-claimed crates", async () => {
        expect.hasAssertions();

        const crates = await discoverCargoCrates({ claimedDirs: new Set([join(cwd, "crates", "claimed")]), cwd });

        expect(crates.map((crate) => crate.name)).toStrictEqual(["a", "b", "c"]);
        expect(crates.every((crate) => crate.ecosystem === "cargo")).toBe(true);
    });

    it("resolves an inherited version and marks publish = false as private", async () => {
        expect.hasAssertions();

        const crates = await discoverCargoCrates({ claimedDirs: new Set(), cwd });
        const byName = new Map(crates.map((crate) => [crate.name, crate]));

        expect(byName.get("a")).toMatchObject({ private: false, version: "1.0.0" });
        expect(byName.get("c")).toMatchObject({ private: true, version: "0.1.0" });
    });

    it("keys path-dependency edges by the real package name, not the rename", async () => {
        expect.hasAssertions();

        const crates = await discoverCargoCrates({ claimedDirs: new Set(), cwd });
        const b = crates.find((crate) => crate.name === "b");

        expect(b?.manifest.dependencies).toStrictEqual({ a: "1.0.0" });
    });

    it("resolves an inherited version from the nearest ancestor workspace root", async () => {
        expect.hasAssertions();

        await expect(findInheritedWorkspaceVersion(join(cwd, "crates", "a", "Cargo.toml"))).resolves.toBe("1.0.0");
    });

    it("returns nothing without a root Cargo.toml", async () => {
        expect.hasAssertions();

        rmSync(join(cwd, "Cargo.toml"));

        await expect(discoverCargoCrates({ claimedDirs: new Set(), cwd })).resolves.toStrictEqual([]);
    });

    it("refuses a ** member pattern instead of walking the tree", async () => {
        expect.hasAssertions();

        writeFileSync(join(cwd, "Cargo.toml"), "[workspace]\nmembers = [\"crates/**\"]\n");

        await expect(discoverCargoCrates({ claimedDirs: new Set(), cwd })).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });
});
