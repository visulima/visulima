import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planNuGetWorkspace } from "../../../src/release/core/nuget-plan";
import { discoverNuGetProjects } from "../../../src/release/core/nuget-projects";

const project = (version: string, extra = ""): string => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Version>${version}</Version>
    ${extra}
  </PropertyGroup>
</Project>
`;

/** NuGet projects as release packages, and the plan that writes their versions. Discovery refuses what it cannot read to a version. */
describe("nuget projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (claimed: string[] = []) => discoverNuGetProjects({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-nuget-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("releases a project with a literal version, named by its lowercased PackageId", async () => {
        expect.hasAssertions();

        write("src/Lib/Lib.csproj", project("1.2.0", "<PackageId>Contoso.Lib</PackageId>"));

        const [found] = await discover();

        expect(found).toMatchObject({ kind: "literal", line: 4, name: "contoso.lib", owner: join(cwd, "src/Lib/Lib.csproj") });
        expect(found?.package).toMatchObject({ ecosystem: "nuget", version: "1.2.0" });
    });

    it("falls back to AssemblyName, then the file name", async () => {
        expect.hasAssertions();

        write("a/A.csproj", project("1.0.0", "<AssemblyName>Assembly.Name</AssemblyName>"));
        write("b/Plain.csproj", project("1.0.0"));

        const found = await discover();
        const names = found.map((entry) => entry.name);

        expect(names).toStrictEqual(["assembly.name", "plain"]);
    });

    it("gives every project under one Directory.Build.props the props owner, at one line", async () => {
        expect.hasAssertions();

        write("Directory.Build.props", "<Project>\n  <PropertyGroup>\n    <Version>2.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
        write("One/One.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
        write("Two/Two.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");

        const found = await discover();

        expect(found.map((entry) => [entry.name, entry.kind, entry.owner, entry.line])).toStrictEqual([
            ["one", "inherited", join(cwd, "Directory.Build.props"), 3],
            ["two", "inherited", join(cwd, "Directory.Build.props"), 3],
        ]);
    });

    it("lets a project's own literal override the props value, as MSBuild does", async () => {
        expect.hasAssertions();

        write("Directory.Build.props", "<Project>\n  <PropertyGroup>\n    <Version>2.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
        write("Own/Own.csproj", project("9.0.0"));

        const [found] = await discover();

        expect(found).toMatchObject({ kind: "literal", name: "own", owner: join(cwd, "Own/Own.csproj") });
        expect(found?.package.version).toBe("9.0.0");
    });

    it("does not release a project with no version, or one that is not packable", async () => {
        expect.hasAssertions();

        write("Aggregate/Aggregate.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
        write("Tests/Tests.csproj", project("1.0.0", "<IsPackable>false</IsPackable>"));

        await expect(discover()).resolves.toStrictEqual([]);
    });

    it("skips projects under a claimed JS package directory and under bin or obj", async () => {
        expect.hasAssertions();

        write("js/Lib.csproj", project("1.0.0"));
        write("bin/Stray.csproj", project("1.0.0"));
        write("Real/Real.csproj", project("1.0.0"));

        const found = await discover(["js"]);
        const names = found.map((entry) => entry.name);

        expect(names).toStrictEqual(["real"]);
    });

    it("refuses an MSBuild expression as the version", async () => {
        expect.hasAssertions();

        write("Expr/Expr.csproj", project("$(MyVersion)"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("plain literal") });
    });

    it("refuses a PackageVersion, VersionSuffix or Import that could set the version elsewhere", async () => {
        expect.hasAssertions();

        write("Pv/Pv.csproj", project("1.0.0", "<PackageVersion>3.0.0</PackageVersion>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("PackageVersion") });

        rmSync(join(cwd, "Pv"), { force: true, recursive: true });
        write("Sf/Sf.csproj", project("1.0.0", "<VersionSuffix>rc</VersionSuffix>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("VersionSuffix") });

        rmSync(join(cwd, "Sf"), { force: true, recursive: true });
        write("Im/Im.csproj", project("1.0.0", "<Import Project=\"x.props\" />"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("imports") });
    });

    it("refuses a Version in a conditional PropertyGroup", async () => {
        expect.hasAssertions();

        write("Cond/Cond.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <PropertyGroup Condition=\"'$(Configuration)' == 'Release'\">\n    <Version>1.0.0</Version>\n  </PropertyGroup>\n</Project>\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("conditional") });
    });

    it("refuses a Version declared twice in one file", async () => {
        expect.hasAssertions();

        write("Twice/Twice.csproj", project("1.0.0", "<Version>1.0.1</Version>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("2 times") });
    });

    it("refuses a Version in Directory.Build.targets, which MSBuild applies after the project", async () => {
        expect.hasAssertions();

        write("Directory.Build.targets", "<Project>\n  <PropertyGroup>\n    <Version>5.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
        write("T/T.csproj", project("1.0.0"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("Directory.Build.targets") });
    });

    it("refuses a package id that is not a valid package name", async () => {
        expect.hasAssertions();

        write("Bad/Bad.csproj", project("1.0.0", "<PackageId>Bad Name</PackageId>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("not a valid package name") });
    });

    it("refuses two projects that share a package id, ignoring case", async () => {
        expect.hasAssertions();

        write("X/X.csproj", project("1.0.0", "<PackageId>Shared.Id</PackageId>"));
        write("Y/Y.csproj", project("1.0.0", "<PackageId>shared.id</PackageId>"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("shared.id") });
    });

    it("ignores a commented-out version", async () => {
        expect.hasAssertions();

        write("Cmt/Cmt.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <!-- <Version>9.9.9</Version> -->\n  <PropertyGroup><Version>1.0.0</Version></PropertyGroup>\n</Project>\n");

        const [found] = await discover();

        expect(found?.package.version).toBe("1.0.0");
    });

    it("records a ProjectReference to another released project as a * dependency", async () => {
        expect.hasAssertions();

        write("Core/Core.csproj", project("1.0.0"));
        write("App/App.csproj", project("1.0.0", String.raw`<ProjectReference Include="..\Core\Core.csproj" />`));

        const found = await discover();
        const app = found.find((entry) => entry.name === "app");

        expect(app?.package.manifest.dependencies).toStrictEqual({ core: "*" });
    });

    it("does not release a test project under a shared props version, but still releases the library beside it", async () => {
        expect.hasAssertions();

        write("Directory.Build.props", "<Project>\n  <PropertyGroup>\n    <Version>2.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
        write("Lib/Lib.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
        write("Tests/Tests.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <ItemGroup>\n    <PackageReference Include=\"Microsoft.NET.Test.Sdk\" Version=\"17.0.0\" />\n  </ItemGroup>\n</Project>\n");

        const found = await discover();

        expect(found.map((entry) => [entry.name, entry.owner])).toStrictEqual([["lib", join(cwd, "Directory.Build.props")]]);
    });

    describe("plan", () => {
        it("writes a lockstep props version once, and a project's own version in its file", async () => {
            expect.hasAssertions();

            write("Directory.Build.props", "<Project>\n  <PropertyGroup>\n    <Version>2.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
            write("One/One.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
            write("Two/Two.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
            write("Own/Own.csproj", project("9.0.0"));

            const projects = await discover();
            const pending = new Map<string, string>();
            const touched = await planNuGetWorkspace({
                pending,
                projects,
                releases: [
                    { name: "one", newVersion: "2.1.0" },
                    { name: "two", newVersion: "2.1.0" },
                    { name: "own", newVersion: "9.1.0" },
                ],
            });

            expect(touched).toStrictEqual(new Set([join(cwd, "Directory.Build.props"), join(cwd, "Own/Own.csproj")]));
            expect(pending.get(join(cwd, "Directory.Build.props"))).toContain("<Version>2.1.0</Version>");
            expect(pending.get(join(cwd, "Own/Own.csproj"))).toContain("<Version>9.1.0</Version>");
            expect(readFileSync(join(cwd, "Directory.Build.props"), "utf8")).toContain("<Version>2.0.0</Version>");
        });

        it("refuses a lockstep props group that is only partly released", async () => {
            expect.hasAssertions();

            write("Directory.Build.props", "<Project>\n  <PropertyGroup>\n    <Version>2.0.0</Version>\n  </PropertyGroup>\n</Project>\n");
            write("One/One.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");
            write("Two/Two.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n");

            const projects = await discover();

            await expect(planNuGetWorkspace({ pending: new Map(), projects, releases: [{ name: "one", newVersion: "2.1.0" }] })).rejects.toMatchObject({
                code: "CONFIG_INVALID",
                message: expect.stringContaining("two"),
            });
        });
    });
});
