import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planDartWorkspace } from "../../../src/release/core/dart-plan";
import { discoverDartProjects } from "../../../src/release/core/dart-projects";
import { replaceDartVersion, scanDartPubspec } from "../../../src/util/dart-pubspec";

describe(discoverDartProjects, () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (claimed: string[] = []) => discoverDartProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-dart-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("returns nothing without a root pubspec", () => {
        expect.hasAssertions();

        write("lib/x.dart", "");

        expect(discover()).toStrictEqual([]);
    });

    it("releases a single root package with a literal version", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: my_pkg\nversion: 1.2.3\n");

        const [project] = discover();

        expect(project?.name).toBe("my_pkg");
        expect(project?.owner).toBe(join(cwd, "pubspec.yaml"));
        expect(project?.package.ecosystem).toBe("dart");
        expect(project?.package.version).toBe("1.2.3");
    });

    it("skips a pubspec with no version and one with publish_to: none", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: flutter_app\n");

        expect(discover()).toStrictEqual([]);

        write("pubspec.yaml", "name: private_pkg\nversion: 1.0.0\npublish_to: none\n");

        expect(discover()).toStrictEqual([]);
    });

    it("refuses a version that is a number, an expression, or not semver", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: pkg\nversion: 1.0\n");

        expect(() => discover()).toThrow(/quote it/);

        write("pubspec.yaml", "name: pkg\nversion: \"${VERSION}\"\n");

        expect(() => discover()).toThrow(/semantic version|plain or quoted literal/);

        write("pubspec.yaml", "name: pkg\nversion: 1.0.0\n  # nested\nenvironment:\n  version: 2.0.0\n");

        expect(discover()[0]?.package.version).toBe("1.0.0");
    });

    it("refuses publish_to pointing at a server other than pub.dev", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: pkg\nversion: 1.0.0\npublish_to: https://example.test\n");

        expect(() => discover()).toThrow(/publish_to/);
    });

    it("refuses duplicate top-level keys through the YAML parser", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: pkg\nversion: 1.0.0\nversion: 2.0.0\n");

        expect(() => discover()).toThrow(/does not parse/);
    });

    it("discovers pub workspace members, orders them by path dependencies by name, and skips the root without a version", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/*\n");
        write("packages/core/pubspec.yaml", "name: core\nversion: 1.0.0\nresolution: workspace\n");
        write("packages/app/pubspec.yaml", "name: app\nversion: 2.0.0\nresolution: workspace\ndependencies:\n  core: ^1.0.0\n  http: ^1.0.0\n");
        mkdirSync(join(cwd, "packages/empty"), { recursive: true });

        const projects = discover();

        expect(projects.map((p) => p.name).sort()).toStrictEqual(["app", "core"]);
        expect(projects.find((p) => p.name === "app")?.package.manifest.dependencies).toStrictEqual({ core: "*" });
    });

    it("refuses a literal workspace entry with no pubspec", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/missing\n");

        expect(() => discover()).toThrow(/no pubspec.yaml/);
    });

    it("refuses a workspace pattern vis cannot expand", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/**\n");

        expect(() => discover()).toThrow(/unsupported pattern/);
    });

    it("skips directories a JS package already claims", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/*\n");
        write("packages/core/pubspec.yaml", "name: core\nversion: 1.0.0\n");

        expect(discover(["packages/core"])).toStrictEqual([]);
    });

    it("rewrites only the owning pubspec's version literal, keeping quotes", async () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/*\n");
        write("packages/core/pubspec.yaml", "name: core\nversion: \"1.0.0\" # keep\n");

        const projects = discover();
        const pending = new Map<string, string>();
        const touched = await planDartWorkspace({ pending, projects, releases: [{ name: "core", newVersion: "1.1.0" }] });

        expect([...touched]).toStrictEqual([join(cwd, "packages/core/pubspec.yaml")]);
        expect(pending.get(join(cwd, "packages/core/pubspec.yaml"))).toBe("name: core\nversion: \"1.1.0\" # keep\n");
        expect(readFileSync(join(cwd, "packages/core/pubspec.yaml"), "utf8")).toContain("1.0.0");
    });

    it("refuses a plan whose version literal changed since discovery", () => {
        expect.hasAssertions();

        expect(() => replaceDartVersion("name: a\nversion: 2.0.0\n", "1.0.0", "1.1.0")).toThrow(/no longer/);
    });

    it("exposes the scan used by the task resolver", () => {
        expect.hasAssertions();

        const scan = scanDartPubspec("name: a\nversion: 0.1.0\nworkspace:\n  - pkgs/a\n");

        expect(scan).toMatchObject({ name: "a", version: { line: 2, value: "0.1.0" }, workspace: ["pkgs/a"] });
    });
});
