import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planGoWorkspace } from "../../../src/release/core/go-plan";
import { discoverGoProjects } from "../../../src/release/core/go-projects";

/**
 * Go modules as release packages: discovery reads the module path and the highest
 * tag, and the plan refuses a major the module path cannot carry.
 */
// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe("go projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const git = (...args: string[]): void => {
        execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd, stdio: "ignore" });
    };

    const tag = (name: string): void => {
        git("tag", name);
    };

    const discover = (claimed: string[] = []) => discoverGoProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-go-")));
        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
        write("README.md", "x\n");
        git("add", ".");
        git("commit", "-q", "-m", "init");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("releases a root go.mod by its module path, starting at 0.0.0 with no tags", async () => {
        expect.hasAssertions();

        write("go.mod", "module github.com/acme/tool\n\ngo 1.22\n");

        const projects = await discover();

        expect(projects).toHaveLength(1);
        expect(projects[0]?.name).toBe("github.com/acme/tool");
        expect(projects[0]?.package.version).toBe("0.0.0");
        expect(projects[0]?.perPackage.releaseTagPattern).toBe("v{version}");
        expect(projects[0]?.perPackage.currentVersionResolver).toBe("disk");
    });

    it("reads the version from the highest tag for the module", async () => {
        expect.hasAssertions();

        write("go.mod", "module github.com/acme/tool\n");
        tag("v1.2.0");
        tag("v1.10.0");
        tag("v2.0.0");
        tag("lib/v9.0.0");

        const projects = await discover();

        // v2.x is ignored (no /v2 suffix), and a tag with a different prefix is not this module's.
        expect(projects[0]?.package.version).toBe("1.10.0");
    });

    it("tags a module in a subdirectory with its directory prefix", async () => {
        expect.hasAssertions();

        write("go.work", "go 1.22\n\nuse (\n\t./lib/core\n)\n");
        write("lib/core/go.mod", "module github.com/acme/tool/lib/core\n");
        tag("lib/core/v0.3.0");

        const projects = await discover();

        expect(projects).toHaveLength(1);
        expect(projects[0]?.perPackage.releaseTagPattern).toBe("lib/core/v{version}");
        expect(projects[0]?.package.version).toBe("0.3.0");
    });

    it("refuses a /vN module with no tag for its major", async () => {
        expect.hasAssertions();

        write("go.mod", "module github.com/acme/tool/v2\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("reads a /vN module's tags from its own major, and tags a v2 directory without the suffix", async () => {
        expect.hasAssertions();

        write("go.work", "go 1.22\n\nuse ./sub/v2\n");
        write("sub/v2/go.mod", "module github.com/acme/tool/sub/v2\n");
        tag("sub/v2.0.0");
        tag("sub/v2.4.0");
        tag("sub/v3.0.0");

        const projects = await discover();

        expect(projects[0]?.suffixMajor).toBe(2);
        expect(projects[0]?.perPackage.releaseTagPattern).toBe("sub/v{version}");
        expect(projects[0]?.package.version).toBe("2.4.0");
    });

    it("refuses a module path with uppercase letters", async () => {
        expect.hasAssertions();

        write("go.mod", "module github.com/Acme/tool\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a go.work use entry with no go.mod", async () => {
        expect.hasAssertions();

        write("go.work", "use ./missing\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a go.work use entry outside the workspace", async () => {
        expect.hasAssertions();

        write("go.work", "use ../elsewhere\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses two modules with the same module path", async () => {
        expect.hasAssertions();

        write("go.work", "use (\n\t./a\n\t./b\n)\n");
        write("a/go.mod", "module github.com/acme/same\n");
        write("b/go.mod", "module github.com/acme/same\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("skips a module a JS package already claims", async () => {
        expect.hasAssertions();

        write("go.work", "use (\n\t./a\n\t./b\n)\n");
        write("a/go.mod", "module github.com/acme/a\n");
        write("b/go.mod", "module github.com/acme/b\n");

        const projects = await discover(["a"]);

        expect(projects.map((project) => project.name)).toStrictEqual(["github.com/acme/b"]);
    });

    it("returns nothing without a go.work or a root go.mod", async () => {
        expect.hasAssertions();

        await expect(discover()).resolves.toStrictEqual([]);
    });
});

describe(planGoWorkspace, () => {
    const project = (name: string, suffixMajor?: number) => {
        return {
            name,
            package: {} as never,
            perPackage: {},
            suffixMajor,
        };
    };

    it("accepts a plain module at major 0 or 1", () => {
        expect.hasAssertions();

        expect(() => { planGoWorkspace({ projects: [project("github.com/a/b")], releases: [{ name: "github.com/a/b", newVersion: "1.4.0" }] }); }).not.toThrow();
    });

    it("refuses a major 2 for a module with no /vN suffix", () => {
        expect.hasAssertions();

        expect(() => { planGoWorkspace({ projects: [project("github.com/a/b")], releases: [{ name: "github.com/a/b", newVersion: "2.0.0" }] }); }).toThrow(/needs a \/v2 module path/u);
    });

    it("accepts a /v2 module at major 2 and refuses 1.x or 3.x", () => {
        expect.hasAssertions();

        const projects = [project("github.com/a/b/v2", 2)];

        expect(() => { planGoWorkspace({ projects, releases: [{ name: "github.com/a/b/v2", newVersion: "2.1.0" }] }); }).not.toThrow();
        expect(() => { planGoWorkspace({ projects, releases: [{ name: "github.com/a/b/v2", newVersion: "3.0.0" }] }); }).toThrow(/must be 2\.x\.y/u);
        expect(() => { planGoWorkspace({ projects, releases: [{ name: "github.com/a/b/v2", newVersion: "1.9.0" }] }); }).toThrow(/must be 2\.x\.y/u);
    });
});
