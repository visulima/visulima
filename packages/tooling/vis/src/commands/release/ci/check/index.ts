import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciCheckOptionDefinitions = {
    "no-fail": {
        description: "Always exit 0 (warnings still print)",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    strict: {
        description: "Require every changed package to be covered by a change file",
        type: Boolean,
    },
} as const;

const ciCheck = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: post or update a sticky PR comment with the pending release plan",
    examples: [
        ["vis release ci check", "Resolve PR from GITHUB_REF, post/update the release plan comment"],
        ["vis release ci check --strict", "Fail if any changed package isn't covered"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "check",
    options: ciCheckOptionDefinitions,
});

export default ciCheck;

export type ReleaseCiCheckOptions = InferOptions<typeof ciCheckOptionDefinitions>;
