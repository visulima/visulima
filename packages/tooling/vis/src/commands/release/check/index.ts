import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const checkOptionDefinitions = {
    hook: {
        description: "Hook context (pre-commit, pre-push) — affects which file states are counted",
        type: String,
    },
    "no-fail": {
        description: "Always exit 0; warnings still print to stderr",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    strict: {
        description: "Require every changed package to have its own non-empty change file",
        type: Boolean,
    },
} as const;

const check = defineCommand({
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
    options: checkOptionDefinitions,
});

export default check;

export type ReleaseCheckOptions = InferOptions<typeof checkOptionDefinitions>;
