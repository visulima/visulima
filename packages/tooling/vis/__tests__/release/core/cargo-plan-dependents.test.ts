import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planCargoWorkspace } from "../../../src/release/core/cargo-plan";

/**
 * `rewriteDependents` decides whether other crates' requirements move when a crate is
 * released. A `cargo()` package (the default) releases its own crate and keeps going; the
 * dependents move only when `cargo.discover` turns the rewrite on.
 */
describe("cargo-plan: rewriteDependents", () => {
    let root: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(root, rel, ".."), { recursive: true });
        writeFileSync(join(root, rel), content);
    };

    const setup = (): void => {
        write("Cargo.toml", "[workspace]\nmembers = [\"a\", \"b\"]\nresolver = \"2\"\n");
        write("a/Cargo.toml", "[package]\nname = \"a\"\nversion = \"0.1.0\"\n");
        write("b/Cargo.toml", "[package]\nname = \"b\"\nversion = \"0.1.0\"\n\n[dependencies]\na = { path = \"../a\", version = \"0.1.0\" }\n");
    };

    const plan = (rewriteDependents: boolean | undefined) => {
        const aManifest = join(root, "a", "Cargo.toml");
        const bManifest = join(root, "b", "Cargo.toml");

        return planCargoWorkspace({
            crateManifests: [aManifest, bManifest],
            cwd: root,
            pending: new Map(),
            releases: [{ ecosystem: "cargo", manifestPaths: [aManifest], name: "a", newVersion: "0.2.0" }],
            rewriteDependents,
            scanManifests: [aManifest, bManifest, join(root, "Cargo.toml")],
        });
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-cargo-dependents-")));
        setup();
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("keeps the dependent's requirement when rewriteDependents is off, and still bumps the released crate", async () => {
        expect.hasAssertions();

        const result = await plan(false);
        const pending = result.touched;

        expect([...pending].some((path) => path.endsWith(join("b", "Cargo.toml")))).toBe(false);
        expect(readFileSync(join(root, "a", "Cargo.toml"), "utf8")).toContain("version = \"0.1.0\"");
    });

    it("moves the dependent's requirement when rewriteDependents is on", async () => {
        expect.hasAssertions();

        const pendingMap = new Map<string, string>();
        const aManifest = join(root, "a", "Cargo.toml");
        const bManifest = join(root, "b", "Cargo.toml");

        await planCargoWorkspace({
            crateManifests: [aManifest, bManifest],
            cwd: root,
            pending: pendingMap,
            releases: [{ ecosystem: "cargo", manifestPaths: [aManifest], name: "a", newVersion: "0.2.0" }],
            rewriteDependents: true,
            scanManifests: [aManifest, bManifest],
        });

        expect(pendingMap.get(bManifest)).toContain("version = \"0.2.0\"");
    });

    it("defaults to rewriting dependents, as before the option existed", async () => {
        expect.hasAssertions();

        const pendingMap = new Map<string, string>();
        const aManifest = join(root, "a", "Cargo.toml");
        const bManifest = join(root, "b", "Cargo.toml");

        await planCargoWorkspace({
            crateManifests: [aManifest, bManifest],
            cwd: root,
            pending: pendingMap,
            releases: [{ ecosystem: "cargo", manifestPaths: [aManifest], name: "a", newVersion: "0.2.0" }],
            scanManifests: [aManifest, bManifest],
        });

        expect(pendingMap.get(bManifest)).toContain("version = \"0.2.0\"");
    });
});
