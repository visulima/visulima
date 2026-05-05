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
 *  - `package-json-fields`: mirrors a small set of metadata fields
 *    (`license`, `author`, `repository`, `bugs`, `homepage`, `engines`)
 *    from the root package.json to every workspace package.json.
 *
 * Additional kinds will land alongside their features (for example:
 * `tsconfig-references`, `package-json` sort, `hooks`).
 */
const sync: Command = {
    argument: {
        description: "What to sync: codeowners | package-json-fields",
        name: "kind",
        type: String,
    },
    description: "Synchronise derived workspace artefacts (codeowners, package.json fields, tsconfig refs, …)",
    examples: [
        ["vis sync codeowners", "Generate CODEOWNERS at the repository root"],
        ["vis sync codeowners --out=.github/CODEOWNERS", "Write to .github/CODEOWNERS instead"],
        ["vis sync codeowners --check", "Fail if the existing file is stale"],
        ["vis sync package-json-fields", "Mirror license/author/repository/bugs/homepage/engines from root to every workspace package"],
        ["vis sync package-json-fields --check", "Fail if any workspace package.json is out of sync"],
        ["vis sync package-json-fields --fields license,engines", "Override the default field list for this run"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "sync",
    options: [
        {
            description: "Output path for the generated file (default: <workspace>/CODEOWNERS) — codeowners kind only",
            name: "out",
            type: String,
        },
        {
            defaultValue: false,
            description: "Verify state without writing (exit non-zero if drift is found)",
            name: "check",
            type: Boolean,
        },
        {
            description: "Comma-separated list of fields to mirror from root → workspace packages (package-json-fields kind only). Repeatable.",
            multiple: true,
            name: "fields",
            type: String,
        },
        {
            description: "Glob pattern of package names to skip (package-json-fields kind only). Repeatable.",
            multiple: true,
            name: "ignore-package-name",
            type: String,
        },
        {
            defaultValue: "human",
            description: "Output format for package-json-fields: human | json",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Suppress per-package log lines; print only the summary (package-json-fields kind only)",
            name: "quiet",
            type: Boolean,
        },
    ],
};

export default sync;

export type SyncOptions = CreateOptions<{
    check: boolean | undefined;
    fields: string[] | undefined;
    format: string | undefined;
    "ignore-package-name": string[] | undefined;
    out: string | undefined;
    quiet: boolean | undefined;
}>;
