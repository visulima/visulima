import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCycloneDxBom } from "../../src/sbom/cyclonedx";
import { findGatedEcosystems, GATED_ECOSYSTEMS, optedInEcosystems, skippedEcosystemsNotice } from "../../src/sbom/ecosystem-gate";
import { buildMavenSbomParts } from "../../src/sbom/maven";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const POM = (artifactId: string, dependency: string): string =>
    [
        "<project>",
        "  <modelVersion>4.0.0</modelVersion>",
        "  <groupId>com.example</groupId>",
        `  <artifactId>${artifactId}</artifactId>`,
        "  <version>1.0.0</version>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.slf4j</groupId>",
        `      <artifactId>${dependency}</artifactId>`,
        "      <version>2.0.9</version>",
        "    </dependency>",
        "  </dependencies>",
        "</project>",
    ].join("\n");

const GO_SUM = ["github.com/gorilla/mux v1.8.0 h1:abc=", "github.com/gorilla/mux v1.8.0/go.mod h1:def=", ""].join("\n");

const CARGO_LOCK = [
    "version = 3",
    "",
    "[[package]]",
    "name = \"app\"",
    "version = \"0.1.0\"",
    "dependencies = [ \"serde\" ]",
    "",
    "[[package]]",
    "name = \"serde\"",
    "version = \"1.0.0\"",
    "",
].join("\n");

const emptyWorkspace = (): { projectGraph: ProjectGraph; workspace: WorkspaceConfiguration } => {
    return {
        projectGraph: { dependencies: {}, nodes: {} },
        workspace: { projects: {} },
    };
};

const NOW = new Date("2026-04-13T00:00:00Z");
const SERIAL = "urn:uuid:00000000-0000-4000-8000-00000000ff31";

describe("sbom: ecosystem gate", () => {
    let root: string;

    beforeEach(() => {
        root = join(createTemporaryDirectory("vis-sbom-gate-"), "repo");
        ensureDirSync(root);
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "1.0.0" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(join(root, ".."));
    });

    it("finds a gated ecosystem by its file and keeps it out without an opt-in", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "pom.xml"), POM("app", "slf4j-api"));

        expect(findGatedEcosystems(root)).toStrictEqual([{ file: "pom.xml", id: "maven" }]);

        const bom = buildCycloneDxBom({ ...emptyWorkspace(), now: NOW, serialNumber: SERIAL, workspaceRoot: root });

        expect(bom.components?.map((component) => component.name)).not.toContain("slf4j-api");
        expect(bom.components?.map((component) => component.name)).not.toContain("app");
    });

    it("includes the Maven graph when maven.discover is on", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "pom.xml"), POM("app", "slf4j-api"));

        const ecosystems = optedInEcosystems({ maven: { discover: true } });
        const bom = buildCycloneDxBom({ ...emptyWorkspace(), ecosystems, now: NOW, serialNumber: SERIAL, workspaceRoot: root });

        expect(ecosystems).toStrictEqual(new Set(["maven"]));
        expect(bom.components?.map((component) => component.name)).toContain("slf4j-api");
        expect(bom.dependencies?.find((dependency) => dependency.ref.includes("/app@"))?.dependsOn).toStrictEqual(["pkg:maven/org.slf4j/slf4j-api@2.0.9"]);
    });

    it("includes Go from go.sum when sbom.ecosystems lists go, without the discover key", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "go.sum"), GO_SUM);

        const ecosystems = optedInEcosystems({ sbom: { ecosystems: ["go"] } });
        const bom = buildCycloneDxBom({ ...emptyWorkspace(), ecosystems, now: NOW, serialNumber: SERIAL, workspaceRoot: root });

        expect(bom.components?.map((component) => component.purl)).toContain("pkg:golang/github.com/gorilla/mux@v1.8.0");
    });

    it("leaves Cargo unchanged without any opt-in", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "Cargo.lock"), CARGO_LOCK);
        writeFileSync(join(root, "Cargo.toml"), "[workspace]\nmembers = [\"app\"]\n");
        ensureDirSync(join(root, "app"));
        writeFileSync(join(root, "app", "Cargo.toml"), "[package]\nname = \"app\"\nversion = \"0.1.0\"\n\n[dependencies]\nserde = \"1\"\n");

        const bom = buildCycloneDxBom({ ...emptyWorkspace(), now: NOW, serialNumber: SERIAL, workspaceRoot: root });

        expect(bom.components?.map((component) => component.name)).toContain("serde");
        expect(findGatedEcosystems(root)).toStrictEqual([]);
    });

    it("says which found ecosystems were skipped, and the key that includes each one", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "go.sum"), GO_SUM);
        writeFileSync(join(root, "pom.xml"), POM("app", "slf4j-api"));

        const notice = skippedEcosystemsNotice(findGatedEcosystems(root).filter(({ id }) => !optedInEcosystems(undefined).has(id)));

        expect(notice).toBe(
            "vis sbom: ecosystems found by file, which does not show they are used. "
            + "pom.xml found; not included. Set maven.discover or add 'maven' to sbom.ecosystems. "
            + "go.sum found; not included. Set go.discover or add 'go' to sbom.ecosystems.",
        );
    });

    it("returns no notice when every found ecosystem is opted in", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "go.sum"), GO_SUM);

        expect(skippedEcosystemsNotice(findGatedEcosystems(root).filter(({ id }) => !optedInEcosystems({ go: { discover: true } }).has(id)))).toBeUndefined();
    });

    it("rejects an unknown id in sbom.ecosystems", () => {
        expect.hasAssertions();

        expect(() => optedInEcosystems({ sbom: { ecosystems: ["cargo" as never] } })).toThrow(/unknown ecosystem "cargo"/);
    });

    it("lists every gated ecosystem id", () => {
        expect.hasAssertions();

        expect(GATED_ECOSYSTEMS).toStrictEqual(["maven", "gradle", "hex", "go", "dart", "swift", "nuget", "zig"]);
    });
});

describe("sbom: maven focus", () => {
    let root: string;

    beforeEach(() => {
        root = join(createTemporaryDirectory("vis-sbom-focus-"), "repo");
        ensureDirSync(join(root, "a"));
        ensureDirSync(join(root, "b"));
        writeFileSync(join(root, "pom.xml"), ["<project>", "  <modelVersion>4.0.0</modelVersion>", "  <groupId>com.example</groupId>", "  <artifactId>parent</artifactId>", "  <version>1.0.0</version>", "  <packaging>pom</packaging>", "  <modules><module>a</module><module>b</module></modules>", "</project>"].join("\n"));
        writeFileSync(join(root, "a", "pom.xml"), POM("a", "slf4j-api"));
        writeFileSync(join(root, "b", "pom.xml"), POM("b", "jul-to-slf4j"));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(join(root, ".."));
    });

    it("keeps only the focused module and its declared dependencies", () => {
        expect.hasAssertions();

        const names = buildMavenSbomParts(root, { focusNames: ["a"] }).components.map((component) => component.name);

        expect(names).toContain("slf4j-api");
        expect(names).not.toContain("jul-to-slf4j");
        expect(names).not.toContain("b");
    });

    it("keeps nothing when no module is named by focus", () => {
        expect.hasAssertions();

        expect(buildMavenSbomParts(root, { focusNames: ["missing"] })).toStrictEqual({ components: [], dependencies: [] });
    });

    it("narrows Maven under --focus at the BOM level, and leaves flat Go as it is", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "go.sum"), GO_SUM);

        const bom = buildCycloneDxBom({
            ecosystems: new Set(["go", "maven"]),
            focus: ["a"],
            now: NOW,
            projectGraph: { dependencies: {}, nodes: {} },
            serialNumber: SERIAL,
            workspace: { projects: {} },
            workspaceRoot: root,
        });
        const names = bom.components?.map((component) => component.name) ?? [];

        expect(names).toContain("slf4j-api");
        expect(names).not.toContain("jul-to-slf4j");
        expect(names).toContain("github.com/gorilla/mux");
    });

    it("keeps the whole graph without focus", () => {
        expect.hasAssertions();

        const names = buildMavenSbomParts(root).components.map((component) => component.name);

        expect(names).toStrictEqual(expect.arrayContaining(["a", "b", "slf4j-api", "jul-to-slf4j"]));
    });
});
