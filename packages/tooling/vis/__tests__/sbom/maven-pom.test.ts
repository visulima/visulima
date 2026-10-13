import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildMavenSbomParts, readMavenModules, toMavenPurl, VERSION_UNRESOLVED_PROPERTY } from "../../src/sbom/maven";

const ROOT_POM = [
    "<project>",
    "  <modelVersion>4.0.0</modelVersion>",
    "  <groupId>com.example</groupId>",
    "  <artifactId>app</artifactId>",
    "  <version>1.2.0</version>",
    "  <packaging>pom</packaging>",
    "  <modules>",
    "    <module>core</module>",
    "    <module>util</module>",
    "  </modules>",
    "  <properties>",
    "    <jackson.version>2.15.2</jackson.version>",
    "  </properties>",
    "  <dependencyManagement>",
    "    <dependencies>",
    "      <dependency><groupId>org.example</groupId><artifactId>managed</artifactId><version>9.9.9</version></dependency>",
    "    </dependencies>",
    "  </dependencyManagement>",
    "  <dependencies>",
    "    <dependency>",
    "      <groupId>com.fasterxml.jackson.core</groupId>",
    "      <artifactId>jackson-databind</artifactId>",
    "      <version>${jackson.version}</version>",
    "    </dependency>",
    "    <dependency>",
    "      <groupId>junit</groupId>",
    "      <artifactId>junit</artifactId>",
    "      <version>4.13.2</version>",
    "      <scope>test</scope>",
    "    </dependency>",
    "    <dependency>",
    "      <groupId>javax.servlet</groupId>",
    "      <artifactId>javax.servlet-api</artifactId>",
    "      <version>4.0.1</version>",
    "      <scope>provided</scope>",
    "    </dependency>",
    "    <dependency><groupId>org.example</groupId><artifactId>templated</artifactId><version>${missing.version}</version></dependency>",
    "    <dependency><groupId>org.example</groupId><artifactId>ranged</artifactId><version>[1.0,2.0)</version></dependency>",
    "    <dependency><groupId>org.example</groupId><artifactId>managed</artifactId></dependency>",
    "  </dependencies>",
    "</project>",
].join("\n");

const CORE_POM = [
    "<project>",
    "  <parent>",
    "    <groupId>com.example</groupId>",
    "    <artifactId>app</artifactId>",
    "    <version>1.2.0</version>",
    "  </parent>",
    "  <artifactId>core</artifactId>",
    "  <dependencies>",
    "    <dependency><groupId>com.example</groupId><artifactId>util</artifactId><version>${project.version}</version></dependency>",
    "  </dependencies>",
    "</project>",
].join("\n");

const UTIL_POM = [
    "<project>",
    "  <parent>",
    "    <groupId>com.example</groupId>",
    "    <artifactId>app</artifactId>",
    "    <version>1.2.0</version>",
    "  </parent>",
    "  <artifactId>util</artifactId>",
    "</project>",
].join("\n");

describe("sbom: buildMavenSbomParts", () => {
    let root: string;

    const write = (relative: string, content: string): void => {
        mkdirSync(dirname(join(root, relative)), { recursive: true });
        writeFileSync(join(root, relative), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-maven-pom-")));
        write("pom.xml", ROOT_POM);
        write("core/pom.xml", CORE_POM);
        write("util/pom.xml", UTIL_POM);
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("builds pkg:maven purls with coordinates encoded per segment", () => {
        expect.hasAssertions();

        expect(toMavenPurl("com.fasterxml.jackson.core", "jackson-databind", "2.15.2")).toBe("pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.2");
        expect(toMavenPurl("org.example", "lib", "1.0+build")).toBe("pkg:maven/org.example/lib@1.0%2Bbuild");
        expect(toMavenPurl("org.example", "lib")).toBe("pkg:maven/org.example/lib");
    });

    it("resolves property and parent-inherited versions, and never invents one", () => {
        expect.hasAssertions();

        const { components } = buildMavenSbomParts(root);
        const byRef = new Map(components.map((component) => [component["bom-ref"], component]));

        expect(byRef.get("pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.2")).toMatchObject({ group: "com.fasterxml.jackson.core", name: "jackson-databind", version: "2.15.2" });
        expect(byRef.get("pkg:maven/com.example/core@1.2.0")).toMatchObject({ name: "core", version: "1.2.0" });

        const templated = byRef.get("pkg:maven/org.example/templated");

        expect(templated).toMatchObject({ name: "templated", properties: [{ name: VERSION_UNRESOLVED_PROPERTY, value: "${missing.version}" }] });
        expect(templated).not.toHaveProperty("version");

        const ranged = byRef.get("pkg:maven/org.example/ranged");

        expect(ranged?.properties).toStrictEqual([{ name: VERSION_UNRESOLVED_PROPERTY, value: "[1.0,2.0)" }]);
        expect(ranged).not.toHaveProperty("version");
    });

    it("gives a dependency with no declared version an unresolved flag with an empty value", () => {
        expect.hasAssertions();

        // The version is managed by the parent's dependencyManagement, which the scan does not apply.
        const managed = buildMavenSbomParts(root).components.find((component) => component.name === "managed");

        expect(managed?.properties).toStrictEqual([{ name: VERSION_UNRESOLVED_PROPERTY, value: "" }]);
    });

    it("leaves test and provided dependencies out unless includeDev is set", () => {
        expect.hasAssertions();

        const names = (includeDev: boolean): string[] => buildMavenSbomParts(root, { includeDev }).components.map((component) => component.name).sort();

        expect(names(false)).not.toContain("junit");
        expect(names(false)).not.toContain("javax.servlet-api");
        expect(names(true)).toContain("junit");
        expect(names(true)).toContain("javax.servlet-api");
    });

    it("marks included test and provided dependencies optional, and the rest required", () => {
        expect.hasAssertions();

        const { components } = buildMavenSbomParts(root, { includeDev: true });

        expect(components.find((component) => component.name === "junit")?.scope).toBe("optional");
        expect(components.find((component) => component.name === "jackson-databind")?.scope).toBe("required");
    });

    it("links each module to its declared dependencies, and dedupes a sibling module by purl", () => {
        expect.hasAssertions();

        const { components, dependencies } = buildMavenSbomParts(root);
        const utilRef = "pkg:maven/com.example/util@1.2.0";

        expect(components.filter((component) => component["bom-ref"] === utilRef)).toHaveLength(1);

        const core = dependencies.find((entry) => entry.ref === "pkg:maven/com.example/core@1.2.0");

        // core inherits the root's <dependencies>, as Maven does, so it also reaches jackson.
        expect(core?.dependsOn).toStrictEqual([
            utilRef,
            "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.2",
            "pkg:maven/org.example/managed",
            "pkg:maven/org.example/ranged",
            "pkg:maven/org.example/templated",
        ]);
        expect(dependencies.find((entry) => entry.ref === "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.2")).toStrictEqual({
            ref: "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.15.2",
        });
    });

    it("reads the root and every module, with each module's dependencies", () => {
        expect.hasAssertions();

        const modules = readMavenModules(root);

        expect(modules.map((module) => `${module.group}:${module.artifact}`)).toStrictEqual(["com.example:app", "com.example:core", "com.example:util"]);
        // core's own dependency comes first; the root's inherited ones follow.
        expect(modules.find((module) => module.artifact === "core")?.dependencies.map((dep) => dep.artifact)).toStrictEqual(["util", "jackson-databind", "junit", "javax.servlet-api", "templated", "ranged", "managed"]);
    });

    it("does not read properties from a parent whose coordinates do not match its <parent> block", () => {
        expect.hasAssertions();

        write("pom.xml", ROOT_POM.replace("<jackson.version>2.15.2</jackson.version>", "<jackson.version>2.15.2</jackson.version><shared.version>3.0</shared.version>"));
        write(
            "util/pom.xml",
            UTIL_POM.replace("<artifactId>app</artifactId>", "<artifactId>other</artifactId>").replace(
                "</project>",
                "  <dependencies><dependency><groupId>org.example</groupId><artifactId>shared</artifactId><version>${shared.version}</version></dependency></dependencies>\n</project>",
            ),
        );

        const util = readMavenModules(root).find((module) => module.artifact === "util");

        expect(util?.dependencies).toMatchObject([{ artifact: "shared", unresolved: "${shared.version}" }]);
        expect(util?.dependencies[0]?.version).toBeUndefined();
    });

    it("returns nothing without a root pom", () => {
        expect.hasAssertions();

        rmSync(join(root, "pom.xml"));

        expect(buildMavenSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
