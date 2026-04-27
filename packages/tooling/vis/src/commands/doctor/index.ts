import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis doctor` — unified project health check.
 *
 * Runs all diagnostic scans in parallel (outdated, vulnerabilities,
 * Socket.dev scores, duplicates, optimization opportunities) and
 * displays a single dashboard with actionable next steps.
 * @example
 * ```sh
 * vis doctor           # full health check
 * vis doctor --json    # machine-readable output
 * ```
 */
const doctor: Command = {
    description: "Run a full project health check (outdated, security, duplicates, optimizations)",
    examples: [
        ["vis doctor", "Full project health check"],
        ["vis doctor --fix", "Check and auto-apply safe fixes"],
        ["vis doctor --format json", "Machine-readable output for CI"],
        ["vis doctor --exit-code", "Exit with code 1 if security issues found"],
        ["vis doctor --exit-code --strict", "Fail on any issue (outdated, duplicates, security)"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "doctor",
    options: [
        { description: "Output format: table or json (default: table)", name: "format", type: String },
        { defaultValue: false, description: "Exit with code 1 if issues found", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Auto-apply safe fixes (security overrides + codemods)", name: "fix", type: Boolean },
        { defaultValue: false, description: "With --exit-code: also fail on outdated and duplicate deps", name: "strict", type: Boolean },
    ],
};

export default doctor;

export type DoctorOptions = CreateOptions<{
    "format": string | undefined;
    "exit-code": boolean | undefined;
    "fix": boolean | undefined;
    "strict": boolean | undefined;
}>;
