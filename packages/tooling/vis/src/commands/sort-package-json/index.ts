import type { Command, CreateOptions } from "@visulima/cerebro";

const sortPackageJson: Command = {
    description: "Sort package.json files across the workspace using the sort-package-json Rust crate",
    examples: [
        ["vis sort-package-json", "Sort all package.json files in the workspace"],
        ["vis sort-package-json --check", "Check if files are already sorted (exit 1 if not)"],
        ["vis sort-package-json --sort-scripts", "Also sort the scripts field alphabetically"],
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
    ],
};

export default sortPackageJson;

export type SortPackageJsonOptions = CreateOptions<{
    "check": boolean | undefined;
    "sort-scripts": boolean | undefined;
}>;
