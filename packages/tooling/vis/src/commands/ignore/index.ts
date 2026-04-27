/**
 * `vis ignore &lt;project>` — CI build gating for deployment platforms.
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
 * `./ignore-helpers` for test isolation.
 */

import type { Command, CreateOptions } from "@visulima/cerebro";

const ignore: Command = {
    argument: {
        description: "Project name to check (required)",
        name: "project",
        type: String,
    },
    description: 'Exit with inverted codes for CI "Ignored Build Step" gating (Vercel/Netlify)',
    examples: [
        ["vis ignore my-app", "Check if my-app is affected and decide whether to build"],
        ["vis ignore my-app --base $VERCEL_GIT_PREVIOUS_SHA", "Explicit base ref"],
        ["vis ignore my-app --json", "Emit the decision as JSON instead of text"],
        ["vis ignore my-app --verbose", "Print debug info about the decision path"],
        ["vis ignore my-app --exit-zero-on-build", "Normal exit semantics (0=build, 0=skip)"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "ignore",
    options: [
        {
            description: "Git base ref for comparison. Defaults to CI provider env vars, then HEAD~1.",
            name: "base",
            type: String,
        },
        {
            defaultValue: "HEAD",
            description: "Git head ref for comparison",
            name: "head",
            type: String,
        },
        {
            defaultValue: "deep",
            description: 'Downstream scope: "none", "direct", or "deep"',
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: 'Upstream scope: "none", "direct", or "deep"',
            name: "upstream",
            type: String,
        },
        {
            defaultValue: false,
            description: "Emit the decision as JSON on stdout instead of human text",
            name: "json",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Exit 0 on build (normal semantics) instead of 1 (inverted Vercel/Netlify semantics)",
            name: "exit-zero-on-build",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Enable verbose debug output",
            name: "verbose",
            type: Boolean,
        },
    ],
};

export default ignore;

export type IgnoreOptions = CreateOptions<{
    "base": string | undefined;
    "head": string | undefined;
    "downstream": string | undefined;
    "upstream": string | undefined;
    "json": boolean | undefined;
    "exit-zero-on-build": boolean | undefined;
    "verbose": boolean | undefined;
}>;
