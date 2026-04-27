import type { Command, CreateOptions } from "@visulima/cerebro";

const unlink: Command = {
    argument: {
        description: "Packages to unlink (omit for current package)",
        name: "packages",
        type: String,
    },
    description: "Unlink a previously linked package",
    examples: [
        ["vis unlink", "Unlink current package"],
        ["vis unlink react", "Unlink specific package"],
        ["vis unlink -r", "Unlink in all workspace packages"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "unlink",
    options: [{ alias: "r", defaultValue: false, description: "Unlink in all workspace packages", name: "recursive", type: Boolean }],
};

export default unlink;

export type UnlinkOptions = CreateOptions<{
    "recursive": boolean | undefined;
}>;
