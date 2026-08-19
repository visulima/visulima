import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const analyzeOptionDefinitions = {
    "ai-type": {
        description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
        type: String,
    },
    format: {
        description: "Output format: table or json (default: table)",
        type: String,
    },
    security: {
        defaultValue: false,
        description: "Check for known security vulnerabilities",
        type: Boolean,
    },
} as const;

const analyze = defineCommand({
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
    options: analyzeOptionDefinitions,
});

export default analyze;

export type AnalyzeOptions = InferOptions<typeof analyzeOptionDefinitions>;
