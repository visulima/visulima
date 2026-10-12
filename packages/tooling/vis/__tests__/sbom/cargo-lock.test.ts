import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCargoSbomParts, toCargoPurl } from "../../src/sbom/cargo";

/**
 * Cargo.lock → CycloneDX parts. Only what the workspace reaches is kept. A
 * dev-dependency of a member counts as dev and is left out unless `includeDev` is set.
 */
const LOCK = [
    "version = 4",
    "",
    "[[package]]",
    "name = \"app\"",
    "version = \"0.1.0\"",
    "dependencies = [",
    " \"serde\",",
    " \"log 0.4.20\",",
    "]",
    "",
    "[[package]]",
    "name = \"serde\"",
    "version = \"1.0.200\"",
    "source = \"registry+https://github.com/rust-lang/crates.io-index\"",
    "",
    "[[package]]",
    "name = \"log\"",
    "version = \"0.4.20\"",
    "source = \"registry+https://github.com/rust-lang/crates.io-index\"",
    "",
    "[[package]]",
    "name = \"log\"",
    "version = \"0.3.9\"",
    "source = \"registry+https://github.com/rust-lang/crates.io-index\"",
    "",
].join("\n");

describe("sbom: buildCargoSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-sbom-cargo-")));
        writeFileSync(join(root, "Cargo.lock"), LOCK);
        writeFileSync(join(root, "Cargo.toml"), "[workspace]\nmembers = [\"app\"]\n");
        mkdirSync(join(root, "app"));
        writeFileSync(join(root, "app", "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.1.0\"\n\n[dependencies]\nserde = \"1\"\n\n[dev-dependencies]\nlog = \"0.4\"\n");
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("keeps the workspace closure and leaves out dev-only dependencies", () => {
        expect.hasAssertions();

        const { components, dependencies } = buildCargoSbomParts(root);

        expect(components.map((component) => component.purl)).toStrictEqual(["pkg:cargo/app@0.1.0", "pkg:cargo/serde@1.0.200"]);
        expect(dependencies.find((dep) => dep.ref === "pkg:cargo/app@0.1.0")).toStrictEqual({
            dependsOn: ["pkg:cargo/serde@1.0.200"],
            ref: "pkg:cargo/app@0.1.0",
        });
    });

    it("includes dev dependencies when includeDev is set", () => {
        expect.hasAssertions();

        const purls = buildCargoSbomParts(root, { includeDev: true }).components.map((component) => component.purl);

        expect(purls).toContain("pkg:cargo/log@0.4.20");
    });

    it("limits the graph to the focused members", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "Cargo.toml"), "[workspace]\nmembers = [\"app\", \"other\"]\n");
        mkdirSync(join(root, "other"));
        writeFileSync(join(root, "other", "Cargo.toml"), "[package]\nname = \"other\"\nversion = \"0.1.0\"\n");

        expect(buildCargoSbomParts(root, { focusNames: ["other"] }).components).toStrictEqual([]);
        expect(buildCargoSbomParts(root, { focusNames: ["app"] }).components.map((component) => component.purl)).toContain("pkg:cargo/app@0.1.0");
    });

    it("returns nothing without a Cargo.lock", () => {
        expect.hasAssertions();

        rmSync(join(root, "Cargo.lock"));

        expect(buildCargoSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });

    it("encodes the purl segments", () => {
        expect.hasAssertions();

        expect(toCargoPurl("my-crate", "1.0.0+build")).toBe("pkg:cargo/my-crate@1.0.0%2Bbuild");
    });
});
