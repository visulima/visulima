import type { Command, CreateOptions } from "@visulima/cerebro";

const doctor: Command = {
    commandPath: ["release"],
    description: "Preflight diagnostics for the release subsystem (workspace, PM, OIDC, NAPI, guards)",
    examples: [
        ["vis release doctor", "Run all checks; exit non-zero if any error"],
        ["vis release doctor --json", "Emit machine-readable report"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "doctor",
    options: [
        {
            description: "Emit machine-readable JSON instead of a table",
            name: "json",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
        {
            description:
                "Bootstrap mode for greenfield monorepos: doctor asserts the workspace has no release tags and no package has been published yet. Pair with `vis release version --first-release`.",
            name: "first-release",
            type: Boolean,
        },
    ],
};

export default doctor;

export type ReleaseDoctorOptions = CreateOptions<{
    "first-release": boolean | undefined;
    json: boolean | undefined;
    "print-config": string | undefined;
}>;
