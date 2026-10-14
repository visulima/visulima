import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

const pom = (artifactId: string): string => `<project><groupId>io.visulima</groupId><artifactId>${artifactId}</artifactId><version>1.0.0</version></project>`;

/**
 * A pom-only directory is a project named by its project-root `&lt;artifactId>`, and
 * it gets the Maven detector alone. A JS package keeps the JS detectors and never
 * gets the Maven targets, even with a stray pom.xml next to it.
 */
describe("maven projects as tasks", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-maven-tasks-"));
        write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write(root, "package.json", JSON.stringify({ name: "root", private: true }));
        write(root, "packages/java-lib/pom.xml", pom("java-lib"));
        write(root, "packages/java-lib/src/main/java/Lib.java", "class Lib {}\n");
        write(root, "packages/web/package.json", JSON.stringify({ name: "web" }));
        write(root, "packages/web/pom.xml", pom("web-jvm"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("is not a task project unless maven.discover is set", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});

        expect(workspace.projects["java-lib"]).toBeUndefined();
    });

    it("names a pom-only directory by its project-root artifactId", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { maven: { discover: true } });

        expect(workspace.projects["java-lib"]).toBeDefined();
    });

    it("infers build and test for the Maven project", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { maven: { discover: true } });
        const targets = workspace.projects["java-lib"]?.targets ?? {};

        expect(targets["build"]?.command).toBe("mvn -B package");
        expect(targets["test"]?.command).toBe("mvn -B test");
        expect(targets["test"]?.cache).toBe(true);
    });

    it("never gives a JS package the Maven targets", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});
        const commands = Object.values(workspace.projects["web"]?.targets ?? {}).map((target) => target.command);

        expect(commands.some((command) => typeof command === "string" && command.includes("mvn"))).toBe(false);
    });
});
