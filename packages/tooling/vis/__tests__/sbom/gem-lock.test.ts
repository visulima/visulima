import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildGemSbomParts, parseGemfileLockEntries, toGemPurl } from "../../src/sbom/gem";

/** The shape `bundle lock` writes for a path gem that depends on rake, with rake depending on nothing. */
const LOCK = [
    "PATH",
    "  remote: .",
    "  specs:",
    "    mygem (0.1.0)",
    "      rake (>= 10)",
    "      other-gem",
    "",
    "GEM",
    "  remote: https://rubygems.org/",
    "  specs:",
    "    other-gem (2.0.0)",
    "    rake (13.3.1)",
    "    unused (1.0.0)",
    "",
    "PLATFORMS",
    "  ruby",
    "",
    "DEPENDENCIES",
    "  mygem!",
    "",
    "BUNDLED WITH",
    "   4.0.20",
    "",
].join("\n");

describe("sbom: buildGemSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-lock-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("reads specs as members (PATH) and dependencies (six spaces)", () => {
        expect.hasAssertions();

        const entries = parseGemfileLockEntries(LOCK);

        expect(entries.find((entry) => entry.name === "mygem")).toMatchObject({ member: true, version: "0.1.0" });
        expect(entries.find((entry) => entry.name === "mygem")?.deps.map((dep) => dep.name)).toStrictEqual(["rake", "other-gem"]);
        expect(entries.find((entry) => entry.name === "rake")?.member).toBe(false);
    });

    it("keeps the closure reachable from the workspace gems, with pkg:gem purls", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "Gemfile.lock"), LOCK);

        const { components, dependencies } = buildGemSbomParts(root);

        expect(components.map((component) => component.purl)).toStrictEqual([
            toGemPurl("mygem", "0.1.0"),
            toGemPurl("other-gem", "2.0.0"),
            toGemPurl("rake", "13.3.1"),
        ]);
        expect(dependencies.find((entry) => entry.ref === "pkg:gem/mygem@0.1.0")?.dependsOn).toStrictEqual(["pkg:gem/other-gem@2.0.0", "pkg:gem/rake@13.3.1"]);
    });

    it("merges platform variants of one gem version into one component", () => {
        expect.hasAssertions();

        const lock = ["GEM", "  remote: https://rubygems.org/", "  specs:", "    nokogiri (1.16.0-arm64-darwin)", "      racc (~> 1.4)", "    nokogiri (1.16.0-x86_64-linux)", "      racc", "    racc (1.8.0)", "", "PATH", "  remote: .", "  specs:", "    host (0.1.0)", "      nokogiri (~> 1.16)", "", ""].join("\n");

        writeFileSync(join(root, "Gemfile.lock"), lock);

        const { components, dependencies } = buildGemSbomParts(root);

        expect(components.map((component) => component.purl).filter((purl) => purl?.includes("nokogiri"))).toStrictEqual(["pkg:gem/nokogiri@1.16.0"]);
        expect(dependencies.find((entry) => entry.ref === "pkg:gem/host@0.1.0")?.dependsOn).toStrictEqual(["pkg:gem/nokogiri@1.16.0"]);
        expect(dependencies.find((entry) => entry.ref === "pkg:gem/nokogiri@1.16.0")?.dependsOn).toStrictEqual(["pkg:gem/racc@1.8.0"]);
    });

    it("focuses on the named gem", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "Gemfile.lock"), LOCK);

        expect(buildGemSbomParts(root, { focusNames: ["other-gem"] }).components).toStrictEqual([]);
    });

    it("is empty without a lockfile", () => {
        expect.hasAssertions();
        expect(buildGemSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
