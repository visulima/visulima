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

interface InstallResult {
    isError: boolean;
    message: string;
}

export type { InstallResult };
export { DEFAULT_HOOKS_DIRECTORY, HOOKS };
