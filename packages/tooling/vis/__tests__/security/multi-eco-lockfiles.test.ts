import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalEcosystem, findEcosystemLockfile, lockedPackagesForEcosystem, mavenUnresolvedDependencies } from "../../src/security/multi-eco-lockfiles";

describe(canonicalEcosystem, () => {
    it("maps cli-style aliases to OSV canonical names", () => {
        expect.assertions(8);

        expect(canonicalEcosystem("pypi")).toBe("PyPI");
        expect(canonicalEcosystem("PyPI")).toBe("PyPI");
        expect(canonicalEcosystem("cargo")).toBe("crates.io");
        expect(canonicalEcosystem("crates.io")).toBe("crates.io");
        expect(canonicalEcosystem("maven")).toBe("Maven");
        expect(canonicalEcosystem("gradle")).toBe("Maven");
        expect(canonicalEcosystem("go")).toBe("Go");
        expect(canonicalEcosystem("rubygems")).toBe("RubyGems");
    });

    it("maps the Hex name to the OSV Hex ecosystem", () => {
        expect.assertions(2);

        expect(canonicalEcosystem("hex")).toBe("Hex");
        expect(canonicalEcosystem("Hex")).toBe("Hex");
    });

    it("maps the Pub and dart names to the OSV Pub ecosystem", () => {
        expect.assertions(3);

        expect(canonicalEcosystem("pub")).toBe("Pub");
        expect(canonicalEcosystem("dart")).toBe("Pub");
        expect(canonicalEcosystem("Pub")).toBe("Pub");
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

    it("parses a pubspec.lock read through the pub alias", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "pubspec.lock"),
            [
                "packages:",
                "  http:",
                "    dependency: \"direct main\"",
                "    description:",
                "      name: http",
                "      url: \"https://pub.dev\"",
                "    source: hosted",
                "    version: \"0.13.2\"",
                "  path:",
                "    dependency: transitive",
                "    description:",
                "      name: path",
                "      url: \"https://pub.dev\"",
                "    source: hosted",
                "    version: \"1.9.0\"",
                "sdks:",
                "  dart: \">=3.0.0 <4.0.0\"",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "pub");

        expect(found).toStrictEqual([
            { isDev: false, name: "http", version: "0.13.2" },
            { isDev: false, name: "path", version: "1.9.0" },
        ]);
        expect(findEcosystemLockfile(workspaceRoot, "dart")).toContain("pubspec.lock");
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

    it("parses a mix.lock, one entry per Hex package and skipping git and path entries", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "mix.lock"),
            [
                "%{",
                "  \"bandit\": {:hex, :bandit, \"1.12.4\", \"10bbab488edf8162318d736c19c5837077b8fca2bf5d95b07b33830387124f62\", [:mix], [{:hpax, \"~> 1.0\", [hex: :hpax, repo: \"hexpm\", optional: false]}, {:plug, \"~> 1.18\", [hex: :plug, repo: \"hexpm\", optional: false]}, {:telemetry, \"~> 0.4 or ~> 1.0\", [hex: :telemetry, repo: \"hexpm\", optional: false]}, {:thousand_island, \"~> 1.5\", [hex: :thousand_island, repo: \"hexpm\", optional: false]}, {:websock, \"~> 0.5\", [hex: :websock, repo: \"hexpm\", optional: false]}], \"hexpm\", \"84513318c5752a2a8017664450f889b47fae5d53d64698ddf1e4fb09a7449e8d\"},",
                "  \"plug\": {:hex, :plug, \"1.20.3\", \"56c480c633ec2ce10140e236e15233bf576e1d323887d7c96711bd02ab5160db\", [:mix], [{:mime, \"~> 1.0 or ~> 2.0\", [hex: :mime, repo: \"hexpm\", optional: false]}, {:plug_crypto, \"~> 1.1.1 or ~> 1.2 or ~> 2.0\", [hex: :plug_crypto, repo: \"hexpm\", optional: false]}, {:telemetry, \"~> 0.4.3 or ~> 1.0\", [hex: :telemetry, repo: \"hexpm\", optional: false]}], \"hexpm\", \"be266aee1b8536ef6409d58cf39a3121319f0ec47cfa1b24024485aa0e76ad76\"},",
                "  \"local_app\": {:git, \"https://example.com/local_app.git\", \"abc123\", []},",
                "  \"mime\": {:hex, :mime, \"2.0.7\", \"b8d739037be7cd402aee1ba0306edfdef982687ee7e9859bee6198c1e7e2f128\", [:mix], [], \"hexpm\", \"6171188e399ee16023ffc5b76ce445eb6d9672e2e241d2df6050f3c771e80ccd\"},",
                "}",
                "",
            ].join("\n"),
        );

        const found = lockedPackagesForEcosystem(workspaceRoot, "hex");

        expect(found).toStrictEqual([
            { isDev: false, name: "bandit", version: "1.12.4" },
            { isDev: false, name: "plug", version: "1.20.3" },
            { isDev: false, name: "mime", version: "2.0.7" },
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

    it("parses a packages.lock.json, one entry per id and version across frameworks", () => {
        expect.assertions(2);

        // Two frameworks: Serilog is locked at a different version in each, and Newtonsoft.Json repeats with the same version.
        writeFileSync(
            join(workspaceRoot, "packages.lock.json"),
            JSON.stringify({
                dependencies: {
                    "net8.0": {
                        "Microsoft.Extensions.Logging": { resolved: "8.0.0", type: "Transitive" },
                        "Newtonsoft.Json": { resolved: "13.0.1", type: "Direct" },
                        Serilog: { dependencies: { "Microsoft.Extensions.Logging": "[8.0.0, )" }, resolved: "3.1.1", type: "Transitive" },
                    },
                    net48: {
                        "Newtonsoft.Json": { resolved: "13.0.1", type: "Direct" },
                        Serilog: { resolved: "3.0.0", type: "Transitive" },
                    },
                },
                version: 2,
            }),
        );

        const packages = lockedPackagesForEcosystem(workspaceRoot, "nuget").map((pkg) => `${pkg.name}@${pkg.version}`);

        // Compared sorted: the entries follow the lock file's key order, which is not part of the contract.
        expect(packages.toSorted()).toStrictEqual(["Microsoft.Extensions.Logging@8.0.0", "Newtonsoft.Json@13.0.1", "Serilog@3.0.0", "Serilog@3.1.1"]);
        expect(canonicalEcosystem("nuget")).toBe("NuGet");
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

describe("maven audit reader", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-maven-audit-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("checks pinned pom versions, including ${property} ones, and skips and reports the rest", () => {
        expect.hasAssertions();

        writeFileSync(
            join(workspaceRoot, "pom.xml"),
            [
                "<project>",
                "  <groupId>com.example</groupId>",
                "  <artifactId>app</artifactId>",
                "  <version>1.0.0</version>",
                "  <properties>",
                "    <log.version>2.17.0</log.version>",
                "  </properties>",
                "  <dependencies>",
                "    <dependency><groupId>org.apache.logging.log4j</groupId><artifactId>log4j-core</artifactId><version>${log.version}</version></dependency>",
                "    <dependency><groupId>junit</groupId><artifactId>junit</artifactId><version>4.13.2</version><scope>test</scope></dependency>",
                "    <dependency><groupId>org.example</groupId><artifactId>templated</artifactId><version>${missing.version}</version></dependency>",
                "    <dependency><groupId>org.example</groupId><artifactId>ranged</artifactId><version>[1.0,2.0)</version></dependency>",
                "  </dependencies>",
                "</project>",
            ].join("\n"),
        );

        expect(lockedPackagesForEcosystem(workspaceRoot, "maven")).toStrictEqual([
            { isDev: false, name: "org.apache.logging.log4j:log4j-core", version: "2.17.0" },
            { isDev: false, name: "junit:junit", version: "4.13.2" },
        ]);
        expect(mavenUnresolvedDependencies(workspaceRoot)).toStrictEqual(["org.example:templated", "org.example:ranged"]);
    });

    it("unions the gradle.lockfile of each project with the pom, once per coordinate", () => {
        expect.hasAssertions();

        writeFileSync(join(workspaceRoot, "settings.gradle.kts"), "include(\":app\")\n");
        mkdirSync(join(workspaceRoot, "app"));
        writeFileSync(join(workspaceRoot, "app", "build.gradle.kts"), "plugins { }\n");
        writeFileSync(join(workspaceRoot, "app", "gradle.lockfile"), "com.google.guava:guava:32.1.3-jre=runtimeClasspath\n");
        writeFileSync(join(workspaceRoot, "gradle.lockfile"), "com.google.guava:guava:32.1.3-jre=compileClasspath\norg.example:util:1.0.0=runtimeClasspath\n");

        expect(lockedPackagesForEcosystem(workspaceRoot, "maven")).toStrictEqual([
            { isDev: false, name: "com.google.guava:guava", version: "32.1.3-jre" },
            { isDev: false, name: "org.example:util", version: "1.0.0" },
        ]);
    });
});
