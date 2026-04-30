import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis sync &lt;kind>` performs workspace-wide synchronisations that
 * cannot be derived from a task graph alone.
 *
 * Currently supported kinds:
 *
 *  - `codeowners`: aggregates `owners` entries from every project's
 *    project.json into a single CODEOWNERS file at the repo root
 *    (or `.github/CODEOWNERS` when the target flag is set).
 *
 * Additional kinds will land alongside their features (for example:
 * `tsconfig-references`, `package-json` sort, `hooks`).
 */
const sync: Command = {
    argument: {
        description: "What to sync: codeowners",
        name: "kind",
        type: String,
    },
    description: "Synchronise derived workspace artefacts (codeowners, tsconfig refs, …)",
    examples: [
        ["vis sync codeowners", "Generate CODEOWNERS at the repository root"],
        ["vis sync codeowners --out=.github/CODEOWNERS", "Write to .github/CODEOWNERS instead"],
        ["vis sync codeowners --check", "Fail if the existing file is stale"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "sync",
    options: [
        {
            description: "Output path for the generated file (default: <workspace>/CODEOWNERS)",
            name: "out",
            type: String,
        },
        {
            defaultValue: false,
            description: "Verify the existing file is up to date (exit non-zero if stale)",
            name: "check",
            type: Boolean,
        },
    ],
};

export default sync;

export type SyncOptions = CreateOptions<{
    check: boolean | undefined;
    out: string | undefined;
}>;
