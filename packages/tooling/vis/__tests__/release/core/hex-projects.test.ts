import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planHexWorkspace } from "../../../src/release/core/hex-plan";
import { discoverHexProjects } from "../../../src/release/core/hex-projects";

/**
 * Hex packages as release packages, and the plan that writes their versions.
 * Discovery refuses what it cannot read to a version, rather than guessing one.
 */
describe("hex projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (claimed: string[] = []) => discoverHexProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-hex-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("releases each umbrella app and orders a path dependency on another app", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [apps_path: \"apps\", deps: []]\n  end\nend\n");
        write("apps/a/mix.exs", "defmodule A.MixProject do\n  def project do\n    [app: :a, version: \"1.0.0\", deps: [{:b, in_umbrella: true}, {:jason, \"~> 1.4\"}]]\n  end\nend\n");
        write("apps/b/mix.exs", "defmodule B.MixProject do\n  def project do\n    [app: :b, package: [name: \"b_pkg\", licenses: [\"MIT\"]], version: \"2.0.0\"]\n  end\nend\n");

        const projects = await discover();

        expect(projects.map((project) => [project.name, project.kind, project.line])).toStrictEqual([
            ["a", "literal", 3],
            ["b_pkg", "literal", 3],
        ]);
        expect(projects[0]!.package.manifest.dependencies).toStrictEqual({ b_pkg: "*" });
        expect(projects[0]!.owner).toBe(join(cwd, "apps/a/mix.exs"));
    });

    it("reads a version written as @version from a literal attribute", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Tool.MixProject do\n  @version \"0.4.2\"\n\n  def project do\n    [app: :tool, version: @version]\n  end\nend\n");

        const [tool] = await discover();

        expect(tool).toMatchObject({ kind: "attribute", line: 2, name: "tool", owner: join(cwd, "mix.exs") });
        expect(tool!.package.version).toBe("0.4.2");
    });

    it("skips a mix.exs with no version key as an aggregate", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :root, deps: []]\n  end\nend\n");

        await expect(discover()).resolves.toStrictEqual([]);
    });

    it("refuses a version that is an expression", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :root, version: System.get_env(\"VSN\")]\n  end\nend\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses an @version key whose attribute is not a literal", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  @version System.get_env(\"VSN\")\n\n  def project do\n    [app: :root, version: @version]\n  end\nend\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("skips a claimed umbrella app", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [apps_path: \"apps\"]\n  end\nend\n");
        write("apps/a/mix.exs", "defmodule A.MixProject do\n  def project do\n    [app: :a, version: \"1.0.0\"]\n  end\nend\n");

        await expect(discover(["apps/a"])).resolves.toStrictEqual([]);
    });

    it("writes the new version into the literal, keeping the rest of the line", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :a, package: [name: \"a_pkg\"], version: \"1.0.0\"]\n  end\nend\n");

        const projects = await discover();
        const pending = new Map<string, string>();

        const touched = await planHexWorkspace({ pending, projects, releases: [{ name: "a_pkg", newVersion: "1.1.0" }] });

        expect([...touched]).toStrictEqual([join(cwd, "mix.exs")]);
        expect(pending.get(join(cwd, "mix.exs"))).toContain("[app: :a, package: [name: \"a_pkg\"], version: \"1.1.0\"]");
        expect(readFileSync(join(cwd, "mix.exs"), "utf8")).toContain("\"1.0.0\"");
    });

    it("writes @version, not the version key, for an attribute version", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Tool.MixProject do\n  @version \"0.4.2\"\n\n  def project do\n    [app: :tool, version: @version]\n  end\nend\n");

        const pending = new Map<string, string>();

        await planHexWorkspace({ pending, projects: await discover(), releases: [{ name: "tool", newVersion: "0.5.0" }] });

        expect(pending.get(join(cwd, "mix.exs"))).toContain("@version \"0.5.0\"");
    });

    it("refuses a release whose version is not semver", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :a, version: \"1.0.0\"]\n  end\nend\n");

        await expect(planHexWorkspace({ pending: new Map(), projects: await discover(), releases: [{ name: "a", newVersion: "1.0" }] })).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });
    it("treats the umbrella root that mix new --umbrella writes as an aggregate, and still releases its apps", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [apps_path: \"apps\", version: \"0.1.0\", deps: []]\n  end\nend\n");
        write("apps/a/mix.exs", "defmodule A.MixProject do\n  def project do\n    [app: :a, version: \"1.0.0\"]\n  end\nend\n");

        const projects = await discover();

        expect(projects.map((project) => project.name)).toStrictEqual(["a"]);
    });

    it.each([
        ["a concatenated suffix on a literal", "version: \"1.0.0\" <> suffix"],
        ["a concatenated suffix on @version", "version: @version <> \"-dev\""],
        ["interpolation in a version literal", "version: \"#{@major}.0.0\""],
    ])("refuses %s rather than reading a prefix of it", async (_label, versionKey) => {
        expect.hasAssertions();

        write("mix.exs", `defmodule Root.MixProject do\n  @version "1.0.0"\n\n  def project do\n    [app: :root, ${versionKey}]\n  end\nend\n`);

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses interpolation inside the @version attribute", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  @version \"#{System.get_env(\"V\")}\"\n\n  def project do\n    [app: :root, version: @version]\n  end\nend\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("reads package name when name: follows another keyword list in package:", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :a, package: [licenses: [\"MIT\"], name: \"a_pkg\"], version: \"1.0.0\"]\n  end\nend\n");

        const [project] = await discover();

        expect(project!.name).toBe("a_pkg");
    });

    it("refuses a package: that is a function call", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule Root.MixProject do\n  def project do\n    [app: :a, package: package(), version: \"1.0.0\"]\n  end\nend\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("does not read a version from a defp after project/0", async () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule A.MixProject do\n  def project do\n    [app: :a, version: \"1.0.0\"]\n  end\n\n  defp docs do\n    [version: \"9.9.9\"]\n  end\nend\n");

        const [project] = await discover();

        expect(project).toMatchObject({ kind: "literal", line: 3 });
        expect(project!.package.version).toBe("1.0.0");
    });
});
