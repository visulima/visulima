import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCargoSbomParts, toCargoPurl } from "../../src/sbom/cargo";

/**
 * Cargo.lock → CycloneDX parts. A workspace member has no `source`, a registry
 * crate does, and a dependency on a crate locked at two versions carries its
 * version in the lockfile entry.
 */
describe("sbom: buildCargoSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-sbom-cargo-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("emits pkg:cargo components and resolves dependency edges", () => {
        expect.hasAssertions();

        writeFileSync(
            join(root, "Cargo.lock"),
            [
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
            ].join("\n"),
        );

        const { components, dependencies } = buildCargoSbomParts(root);

        expect(components.map((component) => component.purl)).toStrictEqual([
            "pkg:cargo/app@0.1.0",
            "pkg:cargo/serde@1.0.200",
            "pkg:cargo/log@0.4.20",
            "pkg:cargo/log@0.3.9",
        ]);
        expect(dependencies.find((dep) => dep.ref === "pkg:cargo/app@0.1.0")).toStrictEqual({
            dependsOn: ["pkg:cargo/log@0.4.20", "pkg:cargo/serde@1.0.200"],
            ref: "pkg:cargo/app@0.1.0",
        });
    });

    it("returns nothing without a Cargo.lock", () => {
        expect.hasAssertions();

        expect(buildCargoSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });

    it("encodes the purl segments", () => {
        expect.hasAssertions();

        expect(toCargoPurl("my-crate", "1.0.0+build")).toBe("pkg:cargo/my-crate@1.0.0%2Bbuild");
    });
});
