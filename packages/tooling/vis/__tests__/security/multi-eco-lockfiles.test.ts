import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalEcosystem, findEcosystemLockfile, lockedPackagesForEcosystem } from "../../src/security/multi-eco-lockfiles";

describe(canonicalEcosystem, () => {
    it("maps cli-style aliases to OSV canonical names", () => {
        expect.assertions(7);

        expect(canonicalEcosystem("pypi")).toBe("PyPI");
        expect(canonicalEcosystem("PyPI")).toBe("PyPI");
        expect(canonicalEcosystem("cargo")).toBe("crates.io");
        expect(canonicalEcosystem("crates.io")).toBe("crates.io");
        expect(canonicalEcosystem("maven")).toBe("Maven");
        expect(canonicalEcosystem("go")).toBe("Go");
        expect(canonicalEcosystem("rubygems")).toBe("RubyGems");
    });

    it("returns the raw input for unknown ecosystems", () => {
        expect.assertions(1);

        expect(canonicalEcosystem("unknown")).toBe("unknown");
    });
});

describe("findEcosystemLockfile + lockedPackagesForEcosystem", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-multi-eco-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("parses a poetry.lock (TOML) file", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "poetry.lock"),
            [
                "[[package]]",
                "name = \"requests\"",
                "version = \"2.31.0\"",
                "category = \"main\"",
                "",
                "[[package]]",
                "name = \"urllib3\"",
                "version = \"2.0.7\"",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "pypi");

        expect(found).toStrictEqual([
            { isDev: false, name: "requests", version: "2.31.0" },
            { isDev: false, name: "urllib3", version: "2.0.7" },
        ]);
        expect(findEcosystemLockfile(workspaceRoot, "PyPI")).toContain("poetry.lock");
    });

    it("parses a Pipfile.lock (JSON)", () => {
        expect.assertions(3);

        writeFileSync(
            join(workspaceRoot, "Pipfile.lock"),
            JSON.stringify({
                _meta: { hash: { sha256: "xx" } },
                default: {
                    "no-version": { hashes: ["sha:xx"] },
                    requests: { version: "==2.31.0" },
                },
                develop: {
                    pytest: { version: "==7.0.0" },
                },
            }),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "pypi");

        expect(found).toContainEqual({ isDev: false, name: "requests", version: "2.31.0" });
        expect(found).toContainEqual({ isDev: false, name: "pytest", version: "7.0.0" });
        // Skips entries without a version string
        expect(found.find((p) => p.name === "no-version")).toBeUndefined();
    });

    it("parses a Cargo.lock", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "Cargo.lock"),
            [
                "# Cargo lockfile",
                "",
                "[[package]]",
                "name = \"serde\"",
                "version = \"1.0.190\"",
                "",
                "[[package]]",
                "name = \"tokio\"",
                "version = \"1.34.0\"",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "crates.io");

        expect(found).toStrictEqual([
            { isDev: false, name: "serde", version: "1.0.190" },
            { isDev: false, name: "tokio", version: "1.34.0" },
        ]);
    });

    it("parses a pom.xml", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "pom.xml"),
            [
                "<project>",
                "  <dependencies>",
                "    <dependency>",
                "      <groupId>org.example</groupId>",
                "      <artifactId>util</artifactId>",
                "      <version>1.0.0</version>",
                "    </dependency>",
                "    <dependency>",
                "      <groupId>com.fasterxml.jackson.core</groupId>",
                "      <artifactId>jackson-databind</artifactId>",
                "      <version>2.15.2</version>",
                "    </dependency>",
                "    <dependency>",
                "      <groupId>skipped</groupId>",
                "      <artifactId>templated</artifactId>",
                "      <version>${some.prop}</version>",
                "    </dependency>",
                "  </dependencies>",
                "</project>",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "maven");

        expect(found).toStrictEqual([
            { isDev: false, name: "org.example:util", version: "1.0.0" },
            { isDev: false, name: "com.fasterxml.jackson.core:jackson-databind", version: "2.15.2" },
        ]);
    });

    it("parses a gradle.lockfile", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "gradle.lockfile"),
            [
                "# This is a Gradle generated file",
                "org.example:util:1.0.0=runtimeClasspath",
                "com.google.guava:guava:32.1.3-jre=compileClasspath,runtimeClasspath",
                "empty=annotationProcessor",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "maven");

        expect(found).toStrictEqual([
            { isDev: false, name: "org.example:util", version: "1.0.0" },
            { isDev: false, name: "com.google.guava:guava", version: "32.1.3-jre" },
        ]);
    });

    it("parses a go.sum (skipping non-go.mod lines)", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "go.sum"),
            [
                "github.com/foo/bar v1.0.0 h1:hashA",
                "github.com/foo/bar v1.0.0/go.mod h1:hashB",
                "github.com/baz/qux v2.1.0 h1:hashC",
                "github.com/baz/qux v2.1.0/go.mod h1:hashD",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "go");

        expect(found).toStrictEqual([
            { isDev: false, name: "github.com/foo/bar", version: "v1.0.0" },
            { isDev: false, name: "github.com/baz/qux", version: "v2.1.0" },
        ]);
    });

    it("parses a Gemfile.lock", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "Gemfile.lock"),
            [
                "GEM",
                "  remote: https://rubygems.org/",
                "  specs:",
                "    rack (3.0.0)",
                "    rails (7.1.2)",
                "      actioncable (= 7.1.2)",
                "      actionmailbox (= 7.1.2)",
                "    nokogiri (1.16.0)",
                "",
                "PLATFORMS",
                "  ruby",
                "",
                "DEPENDENCIES",
                "  rails",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "rubygems");

        expect(found).toStrictEqual([
            { isDev: false, name: "rack", version: "3.0.0" },
            { isDev: false, name: "rails", version: "7.1.2" },
            { isDev: false, name: "nokogiri", version: "1.16.0" },
        ]);
    });

    it("returns an empty list when no lockfile is present", () => {
        expect.assertions(2);

        expect(lockedPackagesForEcosystem(workspaceRoot, "pypi")).toStrictEqual([]);
        expect(findEcosystemLockfile(workspaceRoot, "pypi")).toBeUndefined();
    });

    it("prefers uv.lock over poetry.lock when both exist", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "poetry.lock"), ["[[package]]", "name = \"poetry-only\"", "version = \"1.0.0\"", ""].join("\n"));
        writeFileSync(join(workspaceRoot, "uv.lock"), ["[[package]]", "name = \"uv-only\"", "version = \"2.0.0\"", ""].join("\n"));

        const found = lockedPackagesForEcosystem(workspaceRoot, "pypi");

        expect(found).toStrictEqual([{ isDev: false, name: "uv-only", version: "2.0.0" }]);
    });
});
