import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planZigWorkspace } from "../../../src/release/core/zig-plan";
import { discoverZigProjects } from "../../../src/release/core/zig-projects";

/**
 * Zig packages as release packages, and the plan that writes their versions.
 * Discovery refuses what it cannot read to a version, rather than guessing one.
 */
describe("zig projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const zon = (name: string, version: string | undefined, deps = ""): string =>
        `.{\n    .name = .${name},\n${version === undefined ? "" : `    .version = "${version}",\n`}${deps}    .paths = .{ "build.zig" },\n}\n`;

    const discover = (claimed: string[] = []) => discoverZigProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    const namesOf = async (claimed: string[] = []): Promise<string[]> => {
        const projects = await discover(claimed);

        return projects.map((project) => project.name);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-zig-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("releases the root and its in-workspace path dependencies, with an edge between them", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("app", "1.0.0", "    .dependencies = .{\n        .core = .{ .path = \"core\" },\n        .remote = .{ .url = \"https://example.com/r.tgz\", .hash = \"1220\" },\n    },\n"));
        write("core/build.zig.zon", zon("core", "2.0.0"));

        const projects = await discover();

        expect(projects.map((project) => project.name).sort()).toStrictEqual(["app", "core"]);

        const app = projects.find((project) => project.name === "app")!;

        expect(app.owner).toBe(join(cwd, "build.zig.zon"));
        expect(app.package.ecosystem).toBe("zig");
        expect(app.package.manifest.dependencies).toStrictEqual({ core: "*" });
    });

    it("skips an aggregate with no version and releases its members", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("workspace", undefined, "    .dependencies = .{ .lib = .{ .path = \"lib\" } },\n"));
        write("lib/build.zig.zon", zon("lib", "0.3.0"));

        await expect(namesOf()).resolves.toStrictEqual(["lib"]);
    });

    it("does not follow a path dependency outside the workspace", async () => {
        expect.hasAssertions();

        const outside = realpathSync(mkdtempSync(join(tmpdir(), "vis-zig-outside-")));

        try {
            writeFileSync(join(outside, "build.zig.zon"), zon("elsewhere", "3.0.0"));
            // Zig string literals take no backslash escapes beyond the plain ones, so a Windows
            // separator would break the manifest parse; forward slashes resolve on every platform.
            const outsidePath = relative(cwd, outside).replaceAll("\\", "/");

            write("build.zig.zon", zon("app", "1.0.0", `    .dependencies = .{ .outside = .{ .path = "${outsidePath}" } },\n`));

            await expect(namesOf()).resolves.toStrictEqual(["app"]);
        } finally {
            rmSync(outside, { force: true, recursive: true });
        }
    });

    it("refuses a name that is not a valid release name", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("MyLib", "1.0.0"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses two packages with the same name", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("app", "1.0.0", "    .dependencies = .{ .twin = .{ .path = \"twin\" } },\n"));
        write("twin/build.zig.zon", zon("app", "1.0.0"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("skips a directory a JS package already releases", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("app", "1.0.0", "    .dependencies = .{ .core = .{ .path = \"core\" } },\n"));
        write("core/build.zig.zon", zon("core", "2.0.0"));

        await expect(namesOf(["core"])).resolves.toStrictEqual(["app"]);
    });

    it("rewrites only the version literal in the owner file", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("app", "1.0.0"));

        const projects = await discover();
        const pending = new Map<string, string>();
        const [project] = projects;

        await planZigWorkspace({ pending, projects, releases: [{ name: "app", newVersion: "1.1.0" }] });

        expect(pending.get(project!.owner)).toBe(readFileSync(project!.owner, "utf8").replace("\"1.0.0\"", "\"1.1.0\""));
    });

    it("refuses a release for a package that was not discovered", async () => {
        expect.hasAssertions();

        write("build.zig.zon", zon("app", "1.0.0"));

        await expect(planZigWorkspace({ pending: new Map(), projects: await discover(), releases: [{ name: "ghost", newVersion: "1.0.1" }] })).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });
});
