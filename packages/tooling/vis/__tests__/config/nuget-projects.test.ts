import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveNuGetProjectDirectories } from "../../src/config/nuget-projects";

/** NuGet task directories: one project file per directory, found by walking the tree, not from the workspace patterns. */
describe("nuget task directories", () => {
    let root: string;

    const touch = (rel: string): void => {
        mkdirSync(join(root, rel, ".."), { recursive: true });
        writeFileSync(join(root, rel), "");
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-nuget-config-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns each directory with one project file, excluding the root", () => {
        expect.hasAssertions();

        touch("Root.csproj");
        touch("src/Lib/Lib.csproj");
        touch("src/App/App.fsproj");

        expect(resolveNuGetProjectDirectories(root, [])).toStrictEqual(["src/App", "src/Lib"]);
    });

    it("skips a directory with more than one project file, and bin, obj and node_modules", () => {
        expect.hasAssertions();

        touch("Two/A.csproj");
        touch("Two/B.csproj");
        touch("bin/Stray/Stray.csproj");
        touch("obj/Gen/Gen.csproj");
        touch("node_modules/dep/dep.csproj");
        touch("Real/Real.csproj");

        expect(resolveNuGetProjectDirectories(root, [])).toStrictEqual(["Real"]);
    });

    it("skips directories under a claimed directory", () => {
        expect.hasAssertions();

        touch("js/Lib/Lib.csproj");
        touch("Other/Other.csproj");

        expect(resolveNuGetProjectDirectories(root, ["js"])).toStrictEqual(["Other"]);
    });
});
