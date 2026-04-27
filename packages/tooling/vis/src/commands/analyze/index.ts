import type { Command, CreateOptions } from "@visulima/cerebro";

const analyze: Command = {
    argument: {
        description: "Package name to analyze (e.g., react)",
        name: "package",
        required: true,
        type: String,
    },
    description: "Analyze a single package update with AI",
    examples: [
        ["vis analyze react", "Analyze updating react to latest"],
        ["vis analyze react 19.0.0", "Analyze updating react to specific version"],
        ["vis analyze react --ai-type security", "Run security-focused analysis"],
        ["vis analyze react --format json", "Output as JSON"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "analyze",
    options: [
        {
            description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
            name: "ai-type",
            type: String,
        },
        {
            defaultValue: false,
            description: "Check for known security vulnerabilities",
            name: "security",
            type: Boolean,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

export default analyze;

export type AnalyzeOptions = CreateOptions<{
    "ai-type": string | undefined;
    "security": boolean | undefined;
    "format": string | undefined;
}>;
