import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planGradleWorkspace } from "../../../src/release/core/gradle-plan";
import { discoverGradleProjects } from "../../../src/release/core/gradle-projects";

/**
 * Gradle modules as release packages, and the plan that writes their versions.
 * Discovery refuses what it cannot read to a version, rather than guessing one.
 */
describe("gradle projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (claimed: string[] = []) => discoverGradleProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-gradle-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("releases the modules that share an allprojects version as one group", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":core\", \":web\")\n");
        write("build.gradle.kts", "allprojects {\n    group = \"io.visulima\"\n    version = \"1.0.0\"\n}\n");
        write("core/build.gradle.kts", "plugins { `java-library` }\n");
        write("web/build.gradle.kts", "dependencies { implementation(project(\":core\")) }\n");

        const projects = await discover();

        expect(projects.map((project) => [project.name, project.kind, project.taskPath])).toStrictEqual([
            ["io.visulima:core", "inherited", ":core"],
            ["io.visulima:web", "inherited", ":web"],
        ]);
        expect(projects[1]!.package.manifest.dependencies).toStrictEqual({ "io.visulima:core": "*" });
        expect(projects[0]!.owner).toBe(join(cwd, "build.gradle.kts"));
    });

    it("prefers a module's own literal over the root allprojects version", async () => {
        expect.hasAssertions();

        write("settings.gradle", "include 'app'\n");
        write("build.gradle", "allprojects { group 'io.visulima'; version '1.0.0' }\n");
        write("app/build.gradle", "version = '2.5.0'\n");

        const [app] = await discover();

        expect(app).toMatchObject({ kind: "literal", name: "io.visulima:app", owner: join(cwd, "app/build.gradle") });
        expect(app!.package.version).toBe("2.5.0");
    });

    it("skips an aggregate module that declares no version", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":agg\", \":lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\" }\n");
        write("agg/build.gradle.kts", "// nothing to release\n");
        write("lib/build.gradle.kts", "\n");

        const projects = await discover();

        expect(projects.map((project) => project.name)).toStrictEqual(["io.visulima:agg", "io.visulima:lib"]);
    });

    it("refuses a version that is an expression", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\" }\n");
        write("lib/build.gradle.kts", "version = project.property(\"v\")\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a version declared twice on the path that reaches a module", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\"; version = \"1.0.1\" }\n");
        write("lib/build.gradle.kts", "\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a version with no group", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":lib\")\n");
        write("lib/build.gradle.kts", "version = \"1.0.0\"\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("no group") });
    });

    it("refuses a project moved to another directory, and an archive rename", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":lib\")\nproject(\":lib\").projectDir = file(\"elsewhere\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\" }\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });

        write("settings.gradle.kts", "include(\":lib\")\n");
        write("lib/build.gradle.kts", "base.archivesName = \"renamed\"\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("archive") });
    });

    it("refuses two modules with the same coordinate", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":a:lib\", \":b:lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\" }\n");
        write("a/lib/build.gradle.kts", "\n");
        write("b/lib/build.gradle.kts", "\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("io.visulima:lib") });
    });

    it("leaves a directory a JS package claims out of the release", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":android\", \":lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\" }\n");
        write("android/build.gradle.kts", "\n");
        write("lib/build.gradle.kts", "\n");

        const projects = await discover(["android"]);

        expect(projects.map((project) => project.name)).toStrictEqual(["io.visulima:lib"]);
    });

    it("refuses a version that only gradle.properties sets, rather than skipping the module", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":lib\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\" }\n");
        write("lib/build.gradle.kts", "\n");
        write("gradle.properties", "version=1.0.0\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("gradle.properties") });
    });

    it("returns nothing without a build root or settings", async () => {
        expect.hasAssertions();

        await expect(discover()).resolves.toStrictEqual([]);
    });
});

describe("gradle plan", () => {
    let cwd: string;
    let pending: Map<string, string>;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const read = (rel: string): string => pending.get(join(cwd, rel)) ?? readFileSync(join(cwd, rel), "utf8");

    const plan = async (releases: { name: string; newVersion: string }[]): Promise<Set<string>> => {
        const projects = await discoverGradleProjects({ claimedDirs: new Set(), cwd });

        return planGradleWorkspace({ pending, projects, releases });
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-gradle-plan-")));
        pending = new Map();
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("writes a shared allprojects version once, when every module releases at that version", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":core\", \":web\")\n");
        write("build.gradle.kts", "allprojects {\n    group = \"io.visulima\"\n    version = \"1.0.0\" // shared\n}\n");
        write("core/build.gradle.kts", "\n");
        write("web/build.gradle.kts", "\n");

        const touched = await plan([
            { name: "io.visulima:core", newVersion: "1.1.0" },
            { name: "io.visulima:web", newVersion: "1.1.0" },
        ]);

        expect([...touched]).toStrictEqual([join(cwd, "build.gradle.kts")]);
        expect(read("build.gradle.kts")).toBe("allprojects {\n    group = \"io.visulima\"\n    version = \"1.1.0\" // shared\n}\n");
    });

    it("refuses a partial release of modules that share one declaration", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":core\", \":web\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\"; version = \"1.0.0\" }\n");
        write("core/build.gradle.kts", "\n");
        write("web/build.gradle.kts", "\n");

        await expect(plan([{ name: "io.visulima:core", newVersion: "1.1.0" }])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("bumps a module's own literal in its own script", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":app\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\" }\n");
        write("app/build.gradle.kts", "version = \"0.9.0\"\n");

        await plan([{ name: "io.visulima:app", newVersion: "1.0.0" }]);

        expect(read("app/build.gradle.kts")).toBe("version = \"1.0.0\"\n");
    });

    it("refuses a release for a module that was not discovered", async () => {
        expect.hasAssertions();

        write("settings.gradle.kts", "include(\":app\")\n");
        write("build.gradle.kts", "allprojects { group = \"io.visulima\" }\n");
        write("app/build.gradle.kts", "version = \"1.0.0\"\n");

        await expect(plan([{ name: "io.visulima:missing", newVersion: "1.0.1" }])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });
});
