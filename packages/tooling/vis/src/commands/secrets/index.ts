import type { Command, CreateOptions } from "@visulima/cerebro";

const secrets: Command = {
    argument: {
        description: "One or more paths to scan (defaults to workspace root)",
        name: "paths",
        type: String,
    },
    description: "Scan a repository for hardcoded secrets and credentials",
    examples: [
        ["vis secrets", "Scan the workspace with grouped, colourised output"],
        ["vis secrets --staged", "Scan only files staged for the current commit (pre-commit hooks)"],
        ["vis secrets --since main", "Scan only files changed since the `main` branch"],
        ["vis secrets --affected", "Scan only projects affected by the current branch"],
        ["vis secrets --history", "Scan the full git history for secrets that were committed then removed"],
        ["vis secrets --history --history-range main..HEAD", "Scan only commits on the current branch since main"],
        ["vis secrets --history --max-commits 100 --redact", "Scan the last 100 commits, masking any secret values"],
        ["vis secrets --init", "Write an initial baseline from current findings"],
        ["vis secrets --list-rules", "Print all bundled detection rules"],
        ["vis secrets --list-validators", "Print non-HTTP validator types in the ruleset + install hints for each"],
        ["vis secrets --exclude-rule generic-api-key --exclude-rule aws-access-token", "Drop noisy rules"],
        ["vis secrets --include-rule stripe-access-token", "Check a single rule"],
        ["vis secrets --enable-rule tag:preset:weak-passwords", "Enable an opt-in rule group additively (defaults still fire)"],
        ["vis secrets --include-rule tag:preset:password-manager", "Restrict output to one opt-in group only"],
        ["vis secrets --min-confidence high", "Drop rules without a high confidence label (CI-friendly precision filter)"],
        ["vis secrets --validate --only-verified", "Live-verify each finding against its provider (one HTTP call per finding)"],
        ["vis secrets --exclude 'dist/**' --exclude-from .secretsignore", "Extra gitignore-syntax exclusions for the walker"],
        ["vis secrets --config ./leaks.json --no-extend-bundled", "Use only the supplied config, skip the bundled ruleset"],
        ["vis secrets --concurrency 4", "Cap the rayon thread pool (0 / omit = auto)"],
        ["vis secrets --baseline .secrets-baseline.json", "Suppress known findings; print diff vs. baseline"],
        ["vis secrets --update-baseline", "Merge current findings into the baseline (use --replace-baseline to overwrite)"],
        ["vis secrets --format sarif > report.sarif", "SARIF output for GitHub code-scanning"],
    ],
    group: "Security",
    loader: () => import("./handler"),
    name: "secrets",
    options: [
        { description: "Path to a JSON config (gitleaks-compatible shape). Defaults to the bundled ruleset.", name: "config", type: String },
        {
            description:
                "Drop rules below this author-declared confidence: low (default), medium, high. Rules without a declared confidence (every gitleaks rule) are treated as low, so --min-confidence medium or higher drops them along with explicit low-confidence rules.",
            name: "min-confidence",
            type: String,
        },
        {
            defaultValue: false,
            description:
                "Live-verify each finding against its provider (one HTTP call per finding, max 8 concurrent). Only supports Kingfisher-style HTTP validators with StatusMatch / WordMatch response matchers; other types (gRPC, multi-step, checksum) mark the finding as validation=skipped. WARNING: sends candidate secrets to the provider — some providers alert their security team on failed auth attempts.",
            name: "validate",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "With --validate, drop every finding whose validation is not 'verified'. Useful for CI gating.",
            name: "only-verified",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "With --config, do not merge on top of the bundled ruleset — replace it.",
            name: "no-extend-bundled",
            type: Boolean,
        },
        { defaultValue: "text", description: "Output format: text (default), json, sarif", name: "format", type: String },
        { description: "Path to a baseline JSON of previously-triaged findings", name: "baseline", type: String },
        { defaultValue: false, description: "Scan only files staged for commit", name: "staged", type: Boolean },
        { description: "Scan only files changed since <ref> (e.g. main, origin/HEAD)", name: "since", type: String },
        { defaultValue: false, description: "Scan only projects affected by the current branch", name: "affected", type: Boolean },
        {
            defaultValue: false,
            description:
                "Scan the entire git history (every added/modified blob across commits) instead of the working tree. Surfaces secrets that were committed and later removed. Cannot be combined with --staged/--since/--affected.",
            name: "history",
            type: Boolean,
        },
        {
            description:
                "With --history, limit the walk to a rev-list range (e.g. main..HEAD, HEAD~50..HEAD, or a single ref). Defaults to all reachable history of HEAD.",
            name: "history-range",
            type: String,
        },
        { description: "With --history, cap the number of commits walked (most-recent first)", name: "max-commits", type: Number },
        {
            description:
                "Enable an opt-in rule or tag without restricting output — additive (e.g. tag:preset:weak-passwords, tag:preset:password-manager). Repeatable.",
            multiple: true,
            name: "enable-rule",
            type: String,
        },
        {
            description: "Rule id or tag:<name> selector — whitelist, only matching findings are emitted. Implies enablement. Repeatable.",
            multiple: true,
            name: "include-rule",
            type: String,
        },
        {
            description: "Rule id or tag:<name> selector — drop matching findings. Repeatable.",
            multiple: true,
            name: "exclude-rule",
            type: String,
        },
        { description: "Gitignore-syntax pattern to exclude from the walk (repeatable)", multiple: true, name: "exclude", type: String },
        { description: "Path to a gitignore-shaped file the walker should honor (repeatable)", multiple: true, name: "exclude-from", type: String },
        { defaultValue: false, description: "Mask secret values in output", name: "redact", type: Boolean },
        { defaultValue: false, description: "Scan dotfiles", name: "include-hidden", type: Boolean },
        { defaultValue: false, description: "Do not respect .gitignore", name: "no-gitignore", type: Boolean },
        { description: "Skip files larger than this (bytes). Default: 10 MiB", name: "max-size", type: Number },
        { description: "Rayon worker threads (0 / omit = auto)", name: "concurrency", type: Number },
        { defaultValue: false, description: "Merge current findings into the baseline and exit 0", name: "update-baseline", type: Boolean },
        { defaultValue: false, description: "With --update-baseline, replace rather than merge", name: "replace-baseline", type: Boolean },
        { defaultValue: false, description: "Scaffold a baseline from current findings", name: "init", type: Boolean },
        { defaultValue: false, description: "With --init, preview the baseline without writing files", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Print all bundled detection rules and exit", name: "list-rules", type: Boolean },
        {
            defaultValue: false,
            description: "Print non-HTTP validator types referenced by the current ruleset, with install hints for their optional peer dependencies.",
            name: "list-validators",
            type: Boolean,
        },
        { defaultValue: false, description: "Suppress all progress output (only emit findings)", name: "quiet", type: Boolean },
        { defaultValue: false, description: "Print diagnostic info (skipped rules, etc.)", name: "verbose", type: Boolean },
    ],
};

export default secrets;

export type SecretsOptions = CreateOptions<{
    affected: boolean | undefined;
    baseline: string | undefined;
    concurrency: number | undefined;
    config: string | undefined;
    "dry-run": boolean | undefined;
    "enable-rule": string[] | undefined;
    exclude: string[] | undefined;
    "exclude-from": string[] | undefined;
    "exclude-rule": string[] | undefined;
    format: string | undefined;
    history: boolean | undefined;
    "history-range": string | undefined;
    "include-hidden": boolean | undefined;
    "include-rule": string[] | undefined;
    init: boolean | undefined;
    "list-rules": boolean | undefined;
    "list-validators": boolean | undefined;
    "max-commits": number | undefined;
    "max-size": number | undefined;
    "min-confidence": string | undefined;
    "no-extend-bundled": boolean | undefined;
    "no-gitignore": boolean | undefined;
    "only-verified": boolean | undefined;
    quiet: boolean | undefined;
    redact: boolean | undefined;
    "replace-baseline": boolean | undefined;
    since: string | undefined;
    staged: boolean | undefined;
    "update-baseline": boolean | undefined;
    validate: boolean | undefined;
    verbose: boolean | undefined;
}>;
