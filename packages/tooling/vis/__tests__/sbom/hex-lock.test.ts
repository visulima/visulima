import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildHexSbomParts, parseMixLockEntries } from "../../src/sbom/hex";

const LOCK = [
    "%{",
    "  \"jason\": {:hex, :jason, \"1.4.4\", \"abc\", [:mix], [], \"hexpm\", \"def\"},",
    "  \"plug\": {:hex, :plug, \"1.14.0\", \"ghi\", [:mix], [{:mime, \"~> 1.0\", [hex: :mime, repo: \"hexpm\", optional: false]}, {:jason, \"~> 1.0\", [hex: :jason, repo: \"hexpm\", optional: true]}], \"hexpm\", \"jkl\"},",
    "  \"mime\": {:hex, :mime, \"2.0.5\", \"mno\", [:mix], [], \"hexpm\", \"pqr\"},",
    "  \"local\": {:git, \"https://example.invalid/local.git\", \"sha\", []},",
    "}",
    "",
].join("\n");

describe("hex mix.lock", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-hex-lock-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("reads each hex entry and its dependency names, skipping git entries", () => {
        expect.hasAssertions();

        expect(parseMixLockEntries(LOCK).map((entry) => [entry.name, entry.version, entry.deps.map((dep) => dep.name)])).toStrictEqual([
            ["jason", "1.4.4", []],
            ["plug", "1.14.0", ["mime", "jason"]],
            ["mime", "2.0.5", []],
        ]);
    });

    it("builds hex purls and the dependency edges between locked packages", () => {
        expect.hasAssertions();

        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, "mix.lock"), LOCK);

        const { components, dependencies } = buildHexSbomParts(root);

        expect(components.map((component) => component.purl)).toStrictEqual(["pkg:hex/jason@1.4.4", "pkg:hex/mime@2.0.5", "pkg:hex/plug@1.14.0"]);
        expect(dependencies.find((dependency) => dependency.ref === "pkg:hex/plug@1.14.0")).toStrictEqual({
            dependsOn: ["pkg:hex/jason@1.4.4", "pkg:hex/mime@2.0.5"],
            ref: "pkg:hex/plug@1.14.0",
        });
    });

    it("returns nothing without a mix.lock", () => {
        expect.hasAssertions();

        expect(buildHexSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
