import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildGradleSbomParts, parseGradleLockEntries } from "../../src/sbom/gradle";

const LOCK = [
    "# This is a Gradle generated file for dependency locking.",
    "# Manual edits can break the build and are not advised.",
    "com.google.guava:guava:32.1.3-jre=compileClasspath, runtimeClasspath",
    "org.example:util:1.0.0=runtimeClasspath",
    "junit:junit:4.13.2=testCompileClasspath, testRuntimeClasspath",
    "empty=annotationProcessor",
    "",
].join("\n");

describe("sbom: parseGradleLockEntries", () => {
    it("reads group, artifact, version and configurations, skipping comments and empty=", () => {
        expect.hasAssertions();

        expect(parseGradleLockEntries(LOCK)).toStrictEqual([
            { artifact: "guava", configurations: ["compileClasspath", "runtimeClasspath"], group: "com.google.guava", version: "32.1.3-jre" },
            { artifact: "util", configurations: ["runtimeClasspath"], group: "org.example", version: "1.0.0" },
            { artifact: "junit", configurations: ["testCompileClasspath", "testRuntimeClasspath"], group: "junit", version: "4.13.2" },
        ]);
    });
});

describe("sbom: buildGradleSbomParts", () => {
    let root: string;

    const write = (relative: string, content: string): void => {
        mkdirSync(dirname(join(root, relative)), { recursive: true });
        writeFileSync(join(root, relative), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gradle-lock-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("lists the locked coordinates as a flat list of pkg:maven components", () => {
        expect.hasAssertions();

        write("gradle.lockfile", LOCK);

        const parts = buildGradleSbomParts(root);

        expect(parts.components.map((component) => component["bom-ref"])).toStrictEqual(["pkg:maven/com.google.guava/guava@32.1.3-jre", "pkg:maven/org.example/util@1.0.0"]);
        expect(parts.components[0]).toMatchObject({ group: "com.google.guava", name: "guava", scope: "required", type: "library", version: "32.1.3-jre" });
        expect(parts.dependencies).toStrictEqual([{ ref: "pkg:maven/com.google.guava/guava@32.1.3-jre" }, { ref: "pkg:maven/org.example/util@1.0.0" }]);
    });

    it("includes test-only coordinates only when includeDev is set", () => {
        expect.hasAssertions();

        write("gradle.lockfile", LOCK);

        expect(buildGradleSbomParts(root, { includeDev: true }).components.map((component) => component.name)).toContain("junit");
        expect(buildGradleSbomParts(root, { includeDev: true }).components.find((component) => component.name === "junit")?.scope).toBe("optional");
    });

    it("reads the lockfile of each subproject, and keeps a coordinate locked as runtime anywhere", () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":app\")\n");
        write("app/build.gradle.kts", "plugins { }\n");
        write("gradle.lockfile", "org.example:shared:2.0.0=runtimeClasspath\n");
        write("app/gradle.lockfile", "org.example:shared:2.0.0=testRuntimeClasspath\norg.example:only-app:3.0.0=compileClasspath\n");

        const parts = buildGradleSbomParts(root);

        expect(parts.components.map((component) => component["bom-ref"])).toStrictEqual(["pkg:maven/org.example/only-app@3.0.0", "pkg:maven/org.example/shared@2.0.0"]);
        expect(parts.components.find((component) => component.name === "shared")?.scope).toBe("required");
    });

    it("contributes nothing without a gradle.lockfile, and never guesses a version from build scripts", () => {
        expect.hasAssertions();

        write("build.gradle", "dependencies { implementation 'org.example:guessed:1.0.0' }\n");

        expect(buildGradleSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
