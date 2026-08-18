/**
 * `vis ci ignore &lt;project>` — CI build gating for deployment platforms.
 *
 * Exits with inverted codes so it can be wired directly into Vercel's
 * "Ignored Build Step" field or Netlify's `ignore` command:
 *
 *   exit 0 → platform cancels the build (project is NOT affected)
 *   exit 1 → platform continues the build (project IS affected)
 *
 * Inspired by `nx-ignore` from nrwl/nx-labs, but reuses vis's own
 * `getAffectedProjects` so it doesn't need to bootstrap a parallel
 * Nx installation on the deploy runner. Pure helpers live in
 * `../ci-ignore-helpers` for test isolation.
 */

import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ignoreOptionDefinitions = {
    base: {
        description: "Git base ref for comparison. Defaults to CI provider env vars, then HEAD~1.",
        type: String,
    },
    downstream: {
        defaultValue: "deep",
        description: "Downstream scope: \"none\", \"direct\", or \"deep\"",
        type: String,
    },
    "exit-zero-on-build": {
        defaultValue: false,
        description: "Exit 0 on build (normal semantics) instead of 1 (inverted Vercel/Netlify semantics)",
        type: Boolean,
    },
    head: {
        defaultValue: "HEAD",
        description: "Git head ref for comparison",
        type: String,
    },
    json: {
        defaultValue: false,
        description: "Emit the decision as JSON on stdout instead of human text",
        type: Boolean,
    },
    upstream: {
        defaultValue: "none",
        description: "Upstream scope: \"none\", \"direct\", or \"deep\"",
        type: String,
    },
    verbose: {
        defaultValue: false,
        description: "Enable verbose debug output",
        type: Boolean,
    },
} as const;

const ignore = defineCommand({
    argument: {
        description: "Project name to check (required)",
        name: "project",
        type: String,
    },
    commandPath: ["ci"],
    description: "Exit with inverted codes for CI \"Ignored Build Step\" gating (Vercel/Netlify)",
    examples: [
        ["vis ci ignore my-app", "Check if my-app is affected and decide whether to build"],
        ["vis ci ignore my-app --base $VERCEL_GIT_PREVIOUS_SHA", "Explicit base ref"],
        ["vis ci ignore my-app --json", "Emit the decision as JSON instead of text"],
        ["vis ci ignore my-app --verbose", "Print debug info about the decision path"],
        ["vis ci ignore my-app --exit-zero-on-build", "Normal exit semantics (0=build, 0=skip)"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "ignore",
    options: ignoreOptionDefinitions,
});

export default ignore;

export type IgnoreOptions = InferOptions<typeof ignoreOptionDefinitions>;
