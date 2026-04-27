import type { Command, CreateOptions } from "@visulima/cerebro";

const audit: Command = {
    description: "Audit installed packages for vulnerabilities and supply chain risks",
    examples: [
        ["vis audit", "Full audit of all installed packages"],
        ["vis audit --severity high", "Show only high/critical issues"],
        ["vis audit --format json", "Output as JSON for CI integration"],
        ["vis audit --fix", "Show fix suggestions for vulnerabilities"],
        ["vis audit --exit-code", "Exit with code 1 if issues found (for CI)"],
        ["vis audit --show-accepted", "Include acknowledged risks in output"],
        ["vis audit --sync", `Sync accepted risks to native PM config (pnpm-workspace.yaml / .yarnrc.yml)`],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "audit",
    options: [
        {
            description: "Minimum severity to report: low, medium, high, critical (default: low)",
            name: "severity",
            type: String,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show fix suggestions for vulnerabilities",
            name: "fix",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Exit with code 1 if any issues found (for CI)",
            name: "exit-code",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include acknowledged (accepted risk) issues in output",
            name: "show-accepted",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Sync vis accepted risks to native PM config (pnpm-workspace.yaml / .yarnrc.yml)",
            name: "sync",
            type: Boolean,
        },
    ],
};

export default audit;

export type AuditOptions = CreateOptions<{
    "severity": string | undefined;
    "format": string | undefined;
    "fix": boolean | undefined;
    "exit-code": boolean | undefined;
    "show-accepted": boolean | undefined;
    "sync": boolean | undefined;
}>;
