import type { Command, CreateOptions } from "@visulima/cerebro";

const ai: Command = {
    alias: "a",
    description: "Show AI provider status, test connectivity, and manage cache",
    examples: [
        ["vis ai", "Show all AI providers and their status"],
        ["vis ai --test", "Test the best available provider"],
        ["vis ai --cache-stats", "Show AI response cache statistics"],
        ["vis ai --clear-cache", "Clear the AI response cache"],
        ["vis ai --format json", "Output as JSON"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "ai",
    options: [
        {
            defaultValue: false,
            description: "Test the best available AI provider with a quick prompt",
            name: "test",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Show AI response cache statistics",
            name: "cache-stats",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Clear the AI response cache",
            name: "clear-cache",
            type: Boolean,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

export default ai;

export type AiOptions = CreateOptions<{
    "test": boolean | undefined;
    "cache-stats": boolean | undefined;
    "clear-cache": boolean | undefined;
    "format": string | undefined;
}>;
