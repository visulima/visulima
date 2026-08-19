import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const unlinkOptionDefinitions = {
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Unlink in all workspace packages",
        type: Boolean,
    },
} as const;

const unlink = defineCommand({
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
    options: unlinkOptionDefinitions,
});

export default unlink;

export type UnlinkOptions = InferOptions<typeof unlinkOptionDefinitions>;
