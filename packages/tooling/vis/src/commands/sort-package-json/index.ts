import type { Command, CreateOptions } from "@visulima/cerebro";

const sortPackageJson: Command = {
    description: "Sort package.json files across the workspace using the sort-package-json Rust crate",
    examples: [
        ["vis sort-package-json", "Sort all package.json files in the workspace"],
        ["vis sort-package-json --check", "Check if files are already sorted (exit 1 if not)"],
        ["vis sort-package-json --sort-scripts", "Also sort the scripts field alphabetically"],
        ["vis sort-package-json --indent 4", "Force 4-space indentation (overrides per-file detection)"],
        ["vis sort-package-json --indent tab", "Force tab indentation"],
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
            description: "Indent override: a number of spaces, the literal `tab`, or a literal whitespace string. When unset, the original file's indent is preserved.",
            name: "indent",
            type: String,
        },
    ],
};

export default sortPackageJson;

export type SortPackageJsonOptions = CreateOptions<{
    "check": boolean | undefined;
    "indent": string | undefined;
    "sort-scripts": boolean | undefined;
}>;
