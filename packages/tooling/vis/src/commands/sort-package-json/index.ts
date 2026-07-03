import type { Command, CreateOptions } from "@visulima/cerebro";

const sortPackageJson: Command = {
    description: "Sort package.json files across the workspace using the sort-package-json Rust crate",
    examples: [
        ["vis sort-package-json", "Sort all package.json files in the workspace"],
        ["vis sort-package-json --check", "Check if files are already sorted (exit 1 if not)"],
        ["vis sort-package-json --sort-scripts", "Also sort the scripts field alphabetically"],
        ["vis sort-package-json --indent 4", "Force 4-space indentation (overrides per-file detection)"],
        ["vis sort-package-json --indent tab", "Force tab indentation"],
        ["vis sort-package-json --ignore '**/fixtures/**'", "Skip files matching one or more glob patterns"],
        ["vis sort-package-json --sort-order name,version,license", "Pin a custom prefix order before the default field order"],
        ["vis sort-package-json --unsorted dependencies,devDependencies", "Preserve original key order for the listed top-level sections"],
        ["vis sort-package-json --no-final-newline", "Do not append a trailing newline"],
        ["vis sort-package-json --line-ending crlf", "Force CRLF line endings (default: auto-detect per file)"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "sort-package-json",
    options: [
        {
            alias: "c",
            defaultValue: false,
            description: "Check if package.json files are sorted without writing (exits 1 if unsorted)",
            name: "check",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Also sort the scripts field alphabetically",
            name: "sort-scripts",
            type: Boolean,
        },
        {
            description:
                "Indent override: a number of spaces, the literal `tab`, or a literal whitespace string. When unset, the original file's indent is preserved.",
            name: "indent",
            type: String,
        },
        {
            description: "Glob pattern of files to skip (basename match, or path-relative when the pattern contains `/`). Repeatable.",
            multiple: true,
            name: "ignore",
            type: String,
        },
        {
            description: "Comma-separated list of top-level keys to place first, before the default field order. Repeatable.",
            multiple: true,
            name: "sort-order",
            type: String,
        },
        {
            description: "Comma-separated list of top-level sections whose key order should be preserved (e.g. dependencies,devDependencies). Repeatable.",
            multiple: true,
            name: "unsorted",
            type: String,
        },
        {
            defaultValue: false,
            description: "Do not append a trailing newline to the output (default: append one).",
            name: "no-final-newline",
            type: Boolean,
        },
        {
            defaultValue: "auto",
            description: "Line ending to write: auto (per-file detection, default), lf, or crlf.",
            name: "line-ending",
            type: String,
        },
        {
            description: "Disable collapsing `bugs: { url }` to the bare string form (default: enabled).",
            name: "no-format-bugs",
            type: Boolean,
        },
        {
            description: "Disable collapsing `repository: { type, url }` to the GitHub `owner/repo` shorthand (default: enabled).",
            name: "no-format-repository",
            type: Boolean,
        },
        {
            description: "Disable canonical sorting of `exports` condition keys (default: enabled).",
            name: "no-sort-exports",
            type: Boolean,
        },
        {
            description: "Disable .editorconfig discovery for indent / line-ending defaults (default: enabled).",
            name: "no-editorconfig",
            type: Boolean,
        },
    ],
};

export default sortPackageJson;

export type SortPackageJsonOptions = CreateOptions<{
    check: boolean | undefined;
    editorconfig: boolean | undefined;
    "final-newline": boolean | undefined;
    "format-bugs": boolean | undefined;
    "format-repository": boolean | undefined;
    ignore: string[] | undefined;
    indent: string | undefined;
    "line-ending": string | undefined;
    "sort-exports": boolean | undefined;
    "sort-order": string[] | undefined;
    "sort-scripts": boolean | undefined;
    unsorted: string[] | undefined;
}>;
