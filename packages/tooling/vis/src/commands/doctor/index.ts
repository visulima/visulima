import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

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
const doctorOptionDefinitions = {
    "exit-code": {
        defaultValue: false,
        description: "Exit with code 1 if issues found",
        type: Boolean,
    },
    filter: {
        description: "Comma-separated package name patterns to scope findings (supports * globs, e.g. '@types/*,react')",
        type: String,
    },
    fix: {
        defaultValue: false,
        description: "Auto-apply safe fixes (security overrides + codemods, SIGTERM orphans)",
        type: Boolean,
    },
    "fix-force": {
        defaultValue: false,
        description: "With --fix: escalate orphan cleanup to SIGKILL / taskkill /F (use when SIGTERM is ignored)",
        type: Boolean,
    },
    format: {
        description: "Output format: table or json (default: table). Alias: --json",
        type: String,
    },
    json: {
        defaultValue: false,
        description: "Shorthand for --format json",
        type: Boolean,
    },
    "no-cache": {
        defaultValue: false,
        description: "Bypass the doctor result cache (~/.vis/cache/doctor)",
        type: Boolean,
    },
    "no-progress": {
        defaultValue: false,
        description: "Disable live progress UI (forces sequential logs)",
        type: Boolean,
    },
    only: {
        description: "Comma-separated sections to run: dependencies,security,optimization,runtime",
        type: String,
    },
    quiet: {
        defaultValue: false,
        description: "Suppress per-section detail; print summary only",
        type: Boolean,
    },
    skip: {
        description: "Comma-separated sections to skip",
        type: String,
    },
    strict: {
        defaultValue: false,
        description: "With --exit-code: also fail on outdated and duplicate deps",
        type: Boolean,
    },
} as const;

const doctor = defineCommand({
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
    options: doctorOptionDefinitions,
});

export default doctor;

export type DoctorOptions = InferOptions<typeof doctorOptionDefinitions>;
