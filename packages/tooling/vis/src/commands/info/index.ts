import type { Command, CreateOptions } from "@visulima/cerebro";

const info: Command = {
    alias: "view",
    argument: {
        description: "Package name followed by optional metadata fields (e.g. 'react version dependencies')",
        name: "args",
        type: String,
    },
    description: "Show npm registry metadata for a package (alias of `npm view` / `pnpm view` / `yarn info` / `bun pm view`)",
    examples: [
        ["vis info react", "Full registry metadata for react"],
        ["vis info react version", "Latest version only"],
        ["vis info react versions", "All published versions"],
        ["vis info react@18 dependencies", "Dependencies of react@18"],
        ["vis info react --json", "Emit JSON"],
        ["vis view react", "Alias matching npm/pnpm"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "info",
    options: [{ defaultValue: false, description: "Output as JSON", name: "json", type: Boolean }],
};

export default info;

export type InfoOptions = CreateOptions<{
    "json": boolean | undefined;
}>;
