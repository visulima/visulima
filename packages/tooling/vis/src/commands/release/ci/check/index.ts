import type { Command, CreateOptions } from "@visulima/cerebro";

const ciCheck: Command = {
    commandPath: ["release", "ci"],
    description: "CI: post or update a sticky PR comment with the pending release plan",
    examples: [
        ["vis release ci check", "Resolve PR from GITHUB_REF, post/update the release plan comment"],
        ["vis release ci check --strict", "Fail if any changed package isn't covered"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "check",
    options: [
        {
            description: "Require every changed package to be covered by a change file",
            name: "strict",
            type: Boolean,
        },
        {
            description: "Always exit 0 (warnings still print)",
            name: "no-fail",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default ciCheck;

export type ReleaseCiCheckOptions = CreateOptions<{
    "no-fail": boolean | undefined;
    "print-config": string | undefined;
    strict: boolean | undefined;
}>;
