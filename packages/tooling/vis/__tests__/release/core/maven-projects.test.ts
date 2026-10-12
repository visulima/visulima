import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverMavenProjects } from "../../../src/release/core/maven-projects";
import { VisReleaseError } from "../../../src/release/errors";
import { scanPom } from "../../../src/util/maven-pom";

const pom = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n${body}\n</project>\n`;

describe("maven-projects: discovery", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (): ReturnType<typeof discoverMavenProjects> => discoverMavenProjects({ claimedDirs: new Set(), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-maven-disc-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("walks <modules> recursively and names each module groupId:artifactId", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>1.0.0</version><modules><module>a</module><module>b/c</module></modules>"));
        write("a/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));
        write("b/c/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>c</artifactId><version>2.0.0</version>"));

        const projects = await discover();

        expect(projects.map((project) => project.name)).toStrictEqual(["io.visulima:root", "io.visulima:a", "io.visulima:c"]);
        expect(projects.every((project) => project.package.ecosystem === "maven" && !project.package.private)).toBe(true);
        expect(projects[2]!.package.dir).toBe(join(cwd, "b", "c"));
        expect(projects[2]!.package.manifestPath).toBe(join(cwd, "b", "c", "pom.xml"));
    });

    it("returns nothing without a root pom.xml", async () => {
        expect.hasAssertions();

        await expect(discover()).resolves.toStrictEqual([]);
    });

    it("reads a literal project version and marks the module as its own owner", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.2.3</version>"));

        const [project] = await discover();

        expect(project).toMatchObject({ kind: "literal", name: "io.visulima:a", owner: join(cwd, "pom.xml") });
        expect(project!.package.version).toBe("1.2.3");
    });

    it("inherits the version from a parent with a literal <version>", async () => {
        expect.hasAssertions();

        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version><modules><module>child</module></modules>"),
        );
        write(
            "child/pom.xml",
            pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>child</artifactId>"),
        );

        const projects = await discover();
        const child = projects.find((project) => project.name === "io.visulima:child");

        expect(child).toMatchObject({ kind: "inherited", owner: join(cwd, "pom.xml") });
        expect(child!.package.version).toBe("3.0.0");
    });

    it("resolves a ${revision} version from the root <properties>", async () => {
        expect.hasAssertions();

        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version><properties><revision>4.1.0</revision></properties><modules><module>m</module></modules>"),
        );
        write("m/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version></parent><artifactId>m</artifactId><version>${revision}</version>"));

        const projects = await discover();

        expect(projects.map((project) => [project.name, project.kind, project.property, project.owner])).toStrictEqual([
            ["io.visulima:root", "property", "revision", join(cwd, "pom.xml")],
            ["io.visulima:m", "property", "revision", join(cwd, "pom.xml")],
        ]);
        expect(projects[1]!.package.version).toBe("4.1.0");
    });

    it("refuses a version it cannot resolve with CONFIG_INVALID", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>${missing}</version>"));

        const error = await discover().catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisReleaseError);
        expect((error as VisReleaseError).code).toBe("CONFIG_INVALID");
        expect((error as VisReleaseError).message).toContain("${missing}");
    });

    it("refuses a module with no version and no parent on disk", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a pom whose groupId cannot be resolved", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<artifactId>a</artifactId><version>1.0.0</version>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("maps a dependency on a sibling module to its literal version, keyed by groupId:artifactId", async () => {
        expect.hasAssertions();

        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>1.0.0</version><modules><module>a</module><module>b</module></modules>"),
        );
        write("a/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));
        write(
            "b/pom.xml",
            pom(
                "<groupId>io.visulima</groupId><artifactId>b</artifactId><version>1.0.0</version><dependencies><dependency><groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version></dependency></dependencies>",
            ),
        );

        const projects = await discover();
        const b = projects.find((project) => project.name === "io.visulima:b");

        expect(b!.package.manifest.dependencies).toStrictEqual({ "io.visulima:a": "1.0.0" });
    });

    it("maps a dependency on a property version to \"*\" and follows ${project.groupId}", async () => {
        expect.hasAssertions();

        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version><properties><revision>1.0.0</revision></properties><modules><module>a</module><module>b</module></modules>"),
        );
        write("a/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version></parent><artifactId>a</artifactId>"));
        write(
            "b/pom.xml",
            pom(
                "<parent><groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version></parent><artifactId>b</artifactId><dependencies><dependency><groupId>${project.groupId}</groupId><artifactId>a</artifactId><version>${revision}</version></dependency></dependencies>",
            ),
        );

        const projects = await discover();
        const b = projects.find((project) => project.name === "io.visulima:b");

        expect(b!.package.manifest.dependencies).toStrictEqual({ "io.visulima:a": "*" });
    });

    it("ignores comments, dependencyManagement, plugins and exclusions when reading the graph", () => {
        expect.hasAssertions();

        const scan = scanPom(
            pom(
                [
                    "<!-- <version>9.9.9</version> -->",
                    "<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>",
                    "<dependencyManagement><dependencies><dependency><groupId>io.visulima</groupId><artifactId>managed</artifactId><version>7.0.0</version></dependency></dependencies></dependencyManagement>",
                    "<build><plugins><plugin><groupId>x</groupId><version>5.0.0</version></plugin></plugins></build>",
                    "<dependencies><dependency><groupId>io.visulima</groupId><artifactId>b</artifactId><version>1.0.0</version><exclusions><exclusion><groupId>io.visulima</groupId><artifactId>x</artifactId></exclusion></exclusions></dependency></dependencies>",
                ].join("\n"),
            ),
        );

        expect(scan.version?.value).toBe("1.0.0");
        expect(scan.dependencies.map((dependency) => dependency.artifactId?.value)).toStrictEqual(["b"]);
    });
});
