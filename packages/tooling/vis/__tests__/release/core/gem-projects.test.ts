import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planGemWorkspace } from "../../../src/release/core/gem-plan";
import { discoverGemProjects } from "../../../src/release/core/gem-projects";
import { VisReleaseError } from "../../../src/release/errors";

const gemspec = (name: string, version: string, extra = ""): string =>
    `Gem::Specification.new do |spec|\n  spec.name = "${name}"\n  spec.version = "${version}"\n${extra}end\n`;

describe("release: gem projects", () => {
    let root: string;

    const write = (path: string, content: string): void => {
        mkdirSync(join(root, path, ".."), { recursive: true });
        writeFileSync(join(root, path), content);
    };

    const discover = (claimedDirs: string[] = []) => discoverGemProjects({ claimedDirs: new Set(claimedDirs.map((dir) => join(root, dir))), cwd: root });

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-projects-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("discovers one package per gemspec with a literal version", async () => {
        expect.hasAssertions();

        write("core/core.gemspec", gemspec("core", "1.0.0", "  spec.add_dependency \"util\"\n"));
        write("util/util.gemspec", gemspec("util", "1.0.0"));

        const projects = await discover();

        expect(projects.map((project) => [project.name, project.kind, project.owner])).toStrictEqual([
            ["core", "literal", join(root, "core/core.gemspec")],
            ["util", "literal", join(root, "util/util.gemspec")],
        ]);
        expect(projects[0]?.package).toMatchObject({ ecosystem: "gem", manifest: { dependencies: { util: "*" }, version: "1.0.0" } });
    });

    it("reads Name::VERSION from lib/<name>/version.rb and makes that file the owner", async () => {
        expect.hasAssertions();

        write("foo-bar/foo-bar.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"foo-bar\"\n  spec.version = Foo::Bar::VERSION\nend\n");
        write("foo-bar/lib/foo/bar/version.rb", "module Foo\n  module Bar\n    VERSION = \"0.4.0\"\n  end\nend\n");

        const [project] = await discover();

        expect(project).toMatchObject({ kind: "constant", line: 3, name: "foo-bar", owner: join(root, "foo-bar/lib/foo/bar/version.rb") });
        expect(project?.package.version).toBe("0.4.0");
    });

    it("skips an aggregate gemspec with no version", async () => {
        expect.hasAssertions();

        write("agg/agg.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"agg\"\nend\n");

        await expect(discover()).resolves.toStrictEqual([]);
    });

    it("refuses a version expression, a missing version file and two gemspecs in one directory", async () => {
        expect.hasAssertions();

        write("a/a.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"a\"\n  spec.version = \"1.0.#{n}\"\nend\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });

        rmSync(join(root, "a"), { force: true, recursive: true });

        write("b/b.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"b\"\n  spec.version = Bee::VERSION\nend\n");

        await expect(discover()).rejects.toBeInstanceOf(VisReleaseError);

        rmSync(join(root, "b"), { force: true, recursive: true });

        write("c/c.gemspec", gemspec("c", "1.0.0"));
        write("c/d.gemspec", gemspec("d", "1.0.0"));

        await expect(discover()).rejects.toThrow("more than one gemspec");
    });

    it("skips a directory a JS package already releases", async () => {
        expect.hasAssertions();

        write("js/js.gemspec", gemspec("js", "1.0.0"));

        await expect(discover(["js"])).resolves.toStrictEqual([]);
    });

    it("refuses a shared version declaration that is released in part", async () => {
        expect.hasAssertions();

        write("shared/lib/shared/version.rb", "module Shared\n  VERSION = \"1.0.0\"\nend\n");
        const owner = join(root, "shared/lib/shared/version.rb");
        const member = (name: string) => { return { kind: "constant" as const, line: 2, name, owner, package: { dir: root, ecosystem: "gem" as const, manifest: { name, private: false, version: "1.0.0" }, manifestPath: join(root, `${name}.gemspec`), name, private: false, version: "1.0.0" } }; };
        const projects = [member("one"), member("two")];

        await expect(planGemWorkspace({ pending: new Map(), projects, releases: [{ name: "one", newVersion: "1.1.0" }] })).rejects.toThrow("must release together");

        const pending = new Map<string, string>();
        const touched = await planGemWorkspace({ pending, projects, releases: [{ name: "one", newVersion: "1.1.0" }, { name: "two", newVersion: "1.1.0" }] });

        expect([...touched]).toStrictEqual([owner]);
        expect(pending.get(owner)).toBe("module Shared\n  VERSION = \"1.1.0\"\nend\n");
        expect(readFileSync(owner, "utf8")).toContain("\"1.0.0\"");
    });

    it("writes the gemspec literal and refuses a prerelease semver", async () => {
        expect.hasAssertions();

        write("core/core.gemspec", gemspec("core", "1.0.0"));
        const [project] = await discover();
        const pending = new Map<string, string>();

        await expect(planGemWorkspace({ pending, projects: [project!], releases: [{ name: "core", newVersion: "1.1.0-beta.1" }] })).rejects.toThrow("cannot be written");

        await planGemWorkspace({ pending, projects: [project!], releases: [{ name: "core", newVersion: "1.1.0.beta.1" }] });

        expect(pending.get(join(root, "core/core.gemspec"))).toContain("spec.version = \"1.1.0.beta.1\"");
    });
});
