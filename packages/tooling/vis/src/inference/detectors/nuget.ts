import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to NuGet project directories (one `*.csproj` or `*.fsproj` in a
 * directory `resolveNuGetProjectDirectories` kept); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run in the project directory, so the bare `dotnet` verbs find the one
 * project file there. `build` writes `bin/` and `obj/`, so it is uncached like the Gradle
 * build. `test` and `format:check` are `type: "test"` checks with no outputs.
 * `dotnet format --verify-no-changes` exits non-zero when a file would be reformatted,
 * so the check fails rather than passing silently. The format check is only added for a
 * C# project. Refused for F#: the `dotnet format` page on learn.microsoft.com
 * (https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-format) documents no F# support,
 * so an F# directory gets build and test only, and a check that silently formats nothing is avoided.
 * `dotnet test` needs a test project, so enable `nuget.discover` only where the test target
 * is wanted. POSIX only: the Windows path is not verified.
 */
const inputs = [
    "{projectRoot}/*.csproj",
    "{projectRoot}/*.fsproj",
    "{projectRoot}/**/*.cs",
    "{projectRoot}/**/*.fs",
    "{projectRoot}/**/*.editorconfig",
    "{workspaceRoot}/Directory.Build.props",
    "{workspaceRoot}/Directory.Build.targets",
    "{workspaceRoot}/Directory.Packages.props",
    "{workspaceRoot}/global.json",
    "{workspaceRoot}/.editorconfig",
];

export const nugetDetector: Detector = {
    configFiles: ["*.csproj", "*.fsproj"],
    detect: (context: DetectContext): DetectedTargets => {
        const targets: DetectedTargets["targets"] = {
            build: {
                cache: false,
                command: "dotnet build",
                description: "dotnet build (inferred)",
                inputs,
            },
            test: {
                command: "dotnet test",
                description: "dotnet test (inferred)",
                inputs,
                outputs: [],
                type: "test",
            },
        };

        if (context.matchedConfigs.includes("*.csproj")) {
            targets["format:check"] = {
                command: "dotnet format --verify-no-changes",
                description: "dotnet format --verify-no-changes (inferred)",
                inputs,
                outputs: [],
                type: "test",
            };
        }

        return { targets };
    },
    name: "nuget",
};
