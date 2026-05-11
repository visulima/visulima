import type { Command, CreateOptions } from "@visulima/cerebro";

const audit: Command = {
    description: "Audit installed packages for vulnerabilities and supply chain risks",
    examples: [
        ["vis audit", "Full audit of all installed packages"],
        ["vis audit --severity high", "Show only high/critical issues"],
        ["vis audit --format json", "Output as JSON for CI integration"],
        ["vis audit --format sarif", "Output SARIF 2.1.0 for code-scanning uploads"],
        ["vis audit --format csaf", "Output CSAF 2.0 csaf_vex for enterprise vuln pipelines"],
        ["vis audit --format cyclonedx-vex", "Output a CycloneDX 1.7 BOM with vulnerabilities[] (SBOM + VEX)"],
        ["vis audit --report report.html", "Write a self-contained HTML report to ./report.html"],
        ["vis audit --usage", "Only report vulnerabilities in statically-imported packages"],
        ["vis audit --offline", "Query the local OSV cache only (no network)"],
        ["vis audit --offline --db ./vendor.sqlite", "Use a specific advisory DB"],
        ["vis audit --ecosystem npm,pypi", "Scan multiple OSV ecosystems (npm, pypi, crates.io, maven, go, rubygems)"],
        ["vis audit --prod-only", "Skip devDependencies"],
        ["vis audit --fail-on high", "Exit non-zero on any high or critical finding"],
        ["vis audit --fix", "Show fix suggestions for vulnerabilities"],
        ["vis audit --apply", "Apply direct-dep upgrades for vulnerable packages, then rescan (dry-run preview by default)"],
        ["vis audit --apply --yes", "Skip the confirmation prompt and run the upgrades immediately"],
        ["vis audit --apply --allow-major", "Permit major-version bumps when the lowest fix is outside the existing range"],
        ["vis audit --apply-transitive", "Write PM-specific overrides for vulnerable transitives (dry-run preview by default)"],
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
            description: "Output format: table, json, sarif, csaf, or cyclonedx-vex (default: table)",
            name: "format",
            type: String,
        },
        {
            description: "Write a self-contained HTML report to this path. Auto-opens in a TTY when not in CI.",
            name: "report",
            type: String,
        },
        {
            defaultValue: false,
            description: "Only report vulnerabilities in statically-imported packages (reachability filter).",
            name: "usage",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Disable the reachability filter even if enabled in config.",
            name: "no-usage",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Query the local OSV advisory cache only — no network calls. Errors if the cache is missing.",
            name: "offline",
            type: Boolean,
        },
        {
            description: "Override the offline advisory DB path (default: <cache>/vis/advisories/db.sqlite).",
            name: "db",
            type: String,
        },
        {
            description: "Comma-separated list of OSV ecosystems to scan (default: npm). Supported: npm, pypi, crates.io (or 'cargo'), maven, go, rubygems. Non-npm ecosystems require --offline (online OSV path is npm-only).",
            name: "ecosystem",
            type: String,
        },
        {
            defaultValue: false,
            description: "Skip devDependencies — scan production graph only.",
            name: "prod-only",
            type: Boolean,
        },
        {
            description: "Exit non-zero when any finding is at this severity or higher. One of: low, medium, high, critical.",
            name: "fail-on",
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
            description: "Apply direct-dep fixes for vulnerable packages by running the active PM update command, then rescan",
            name: "apply",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Apply transitive fixes by writing PM-specific overrides (pnpm-workspace.yaml / package.json overrides / resolutions)",
            name: "apply-transitive",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip confirmation prompt for --apply / --apply-transitive (required in CI)",
            name: "yes",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Allow --apply to bump a direct dep across a major version when the lowest fix is outside the existing range",
            name: "allow-major",
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
    "allow-major": boolean | undefined;
    apply: boolean | undefined;
    "apply-transitive": boolean | undefined;
    db: string | undefined;
    ecosystem: string | undefined;
    "exit-code": boolean | undefined;
    "fail-on": string | undefined;
    fix: boolean | undefined;
    format: string | undefined;
    "no-usage": boolean | undefined;
    offline: boolean | undefined;
    "prod-only": boolean | undefined;
    report: string | undefined;
    severity: string | undefined;
    "show-accepted": boolean | undefined;
    sync: boolean | undefined;
    usage: boolean | undefined;
    yes: boolean | undefined;
}>;
