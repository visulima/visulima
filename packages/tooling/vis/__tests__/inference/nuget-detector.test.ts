import { describe, expect, it } from "vitest";

import { nugetDetector } from "../../src/inference/detectors/nuget";
import type { DetectContext } from "../../src/inference/types";

const context = (matchedConfigs: string[]): DetectContext => {
    return {
        hasConfigFile: true,
        matchedConfigs,
        pkg: { dependencies: {}, devDependencies: {}, optionalDependencies: {}, peerDependencies: {} },
        projectDirectory: "src/Lib",
        projectRoot: "/repo/src/Lib",
    };
};

/** The NuGet detector: build, test, and a format check that fails on unformatted code. */
describe("nuget detector", () => {
    it("infers build and test, and a format check for a C# project", () => {
        expect.hasAssertions();

        const { targets } = nugetDetector.detect(context(["*.csproj"])) as { targets: Record<string, { cache?: boolean; command: string; outputs?: string[]; type?: string }> };

        expect(targets.build).toMatchObject({ cache: false, command: "dotnet build" });
        expect(targets.test).toMatchObject({ command: "dotnet test", outputs: [], type: "test" });
        expect(targets["format:check"]).toMatchObject({ command: "dotnet format --verify-no-changes", outputs: [], type: "test" });
    });

    it("omits the format check for an F# project, which is not verified", () => {
        expect.hasAssertions();

        const { targets } = nugetDetector.detect(context(["*.fsproj"])) as { targets: Record<string, unknown> };

        expect(Object.keys(targets).sort()).toStrictEqual(["build", "test"]);
    });

    it("is registered for the *.csproj and *.fsproj config files", () => {
        expect.hasAssertions();
        expect(nugetDetector.configFiles).toStrictEqual(["*.csproj", "*.fsproj"]);
        expect(nugetDetector.name).toBe("nuget");
    });
});
