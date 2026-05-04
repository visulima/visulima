import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis doctor` — unified project health check.
 *
 * Runs all diagnostic scans in parallel (outdated, vulnerabilities,
 * Socket.dev scores, duplicates, optimization opportunities) and
 * displays a single dashboard with actionable next steps.
 * @example
 * ```sh
 * vis doctor                       # full health check
 * vis doctor --json                # machine-readable output
 * vis doctor --only security       # only run the security scans
 * vis doctor --skip optimization   # skip optimization scans
 * ```
 */
const doctor: Command = {
    description: "Run a full project health check (outdated, security, duplicates, optimizations)",
    examples: [
        ["vis doctor", "Full project health check"],
        ["vis doctor --fix", "Check and auto-apply safe fixes"],
        ["vis doctor --format json", "Machine-readable output for CI"],
        ["vis doctor --only security", "Only run the security scans"],
        ["vis doctor --skip optimization,runtime", "Skip the listed sections"],
        ["vis doctor --quiet", "Summary only, no per-section breakdown"],
        ["vis doctor --no-progress", "Disable live progress UI (sequential logs)"],
        ["vis doctor --exit-code", "Exit with code 1 if security issues found"],
        ["vis doctor --exit-code --strict", "Fail on any issue (outdated, duplicates, security)"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "doctor",
    options: [
        { description: "Output format: table or json (default: table). Alias: --json", name: "format", type: String },
        { defaultValue: false, description: "Shorthand for --format json", name: "json", type: Boolean },
        { defaultValue: false, description: "Exit with code 1 if issues found", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Auto-apply safe fixes (security overrides + codemods, SIGTERM orphans)", name: "fix", type: Boolean },
        {
            defaultValue: false,
            description: "With --fix: escalate orphan cleanup to SIGKILL / taskkill /F (use when SIGTERM is ignored)",
            name: "fix-force",
            type: Boolean,
        },
        { defaultValue: false, description: "With --exit-code: also fail on outdated and duplicate deps", name: "strict", type: Boolean },
        { description: "Comma-separated sections to run: dependencies,security,optimization,runtime", name: "only", type: String },
        { description: "Comma-separated sections to skip", name: "skip", type: String },
        { defaultValue: false, description: "Suppress per-section detail; print summary only", name: "quiet", type: Boolean },
        { defaultValue: false, description: "Disable live progress UI (forces sequential logs)", name: "no-progress", type: Boolean },
        { defaultValue: false, description: "Bypass the doctor result cache (~/.vis/cache/doctor)", name: "no-cache", type: Boolean },
        {
            description: "Comma-separated package name patterns to scope findings (supports * globs, e.g. '@types/*,react')",
            name: "filter",
            type: String,
        },
    ],
};

export default doctor;

export type DoctorOptions = CreateOptions<{
    "exit-code": boolean | undefined;
    filter: string | undefined;
    fix: boolean | undefined;
    "fix-force": boolean | undefined;
    format: string | undefined;
    json: boolean | undefined;
    "no-cache": boolean | undefined;
    "no-progress": boolean | undefined;
    only: string | undefined;
    quiet: boolean | undefined;
    skip: string | undefined;
    strict: boolean | undefined;
}>;
