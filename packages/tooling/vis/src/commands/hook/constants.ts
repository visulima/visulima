const HOOKS = [
    "pre-commit",
    "pre-merge-commit",
    "prepare-commit-msg",
    "commit-msg",
    "post-commit",
    "applypatch-msg",
    "pre-applypatch",
    "post-applypatch",
    "pre-rebase",
    "post-rewrite",
    "post-checkout",
    "post-merge",
    "pre-push",
    "pre-auto-gc",
] as const;

const DEFAULT_HOOKS_DIRECTORY = ".vis-hooks";

// prek / pre-commit framework config files that we know how to parse.
// YAML files are listed first so they take precedence when both formats exist.
const PREK_CONFIG_FILES = [".pre-commit-config.yaml", ".pre-commit-config.yml", "prek.toml"] as const;

// Legacy pre-commit.com stage names → canonical git hook names.
const PREK_STAGE_ALIASES: Readonly<Record<string, string>> = {
    commit: "pre-commit",
    "merge-commit": "pre-merge-commit",
    push: "pre-push",
};

// Stages we emit scripts for. `manual` is intentionally absent — it is not a git hook.
const PREK_SUPPORTED_STAGES = new Set<string>([
    "commit-msg",
    "post-checkout",
    "post-commit",
    "post-merge",
    "post-rewrite",
    "pre-commit",
    "pre-merge-commit",
    "pre-push",
    "pre-rebase",
    "prepare-commit-msg",
]);

// Stages where git passes a path/argument to the hook — we forward "$@" when pass_filenames is true.
const PREK_STAGES_WITH_GIT_ARGS = new Set<string>(["commit-msg", "post-checkout", "post-merge", "post-rewrite", "pre-rebase", "prepare-commit-msg"]);

// Hook `language` values we can translate to plain shell. Everything else needs the prek binary.
const PREK_TRANSLATABLE_LANGUAGES = new Set<string>(["fail", "script", "system"]);

interface InstallResult {
    isError: boolean;
    message: string;
}

export type { InstallResult };
export { DEFAULT_HOOKS_DIRECTORY, HOOKS, PREK_CONFIG_FILES, PREK_STAGE_ALIASES, PREK_STAGES_WITH_GIT_ARGS, PREK_SUPPORTED_STAGES, PREK_TRANSLATABLE_LANGUAGES };
