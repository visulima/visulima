import type { Command, CreateOptions } from "@visulima/cerebro";

const check: Command = {
    commandPath: ["release"],
    description: "Verify pending change files cover changed packages — CI / husky gate",
    examples: [
        ["vis release check", "Pass if at least one change file exists"],
        ["vis release check --strict", "Fail if any changed package isn't covered by a change file"],
        ["vis release check --hook pre-commit", "Run as a husky pre-commit hook"],
        ["vis release check --no-fail", "Print warnings but always exit 0"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "check",
    options: [
        {
            description: "Require every changed package to have its own non-empty change file",
            name: "strict",
            type: Boolean,
        },
        {
            description: "Hook context (pre-commit, pre-push) — affects which file states are counted",
            name: "hook",
            type: String,
        },
        {
            description: "Always exit 0; warnings still print to stderr",
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

export default check;

export type ReleaseCheckOptions = CreateOptions<{
    hook: string | undefined;
    "no-fail": boolean | undefined;
    "print-config": string | undefined;
    strict: boolean | undefined;
}>;
