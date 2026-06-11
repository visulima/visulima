import { spawnSync } from "node:child_process";

/**
 * Built-in `git subtree` helpers used by `vis split` / `vis import`.
 *
 * Every entry point takes an injectable {@link GitRunner} so the
 * surrounding command logic is unit-testable without touching a real
 * repository (mirrors the pattern in `src/runtime/affected-shas.ts`).
 * The default runner shells out to `git` via `spawnSync`.
 *
 * Prefixes are passed to git verbatim: project roots are already POSIX
 * (`@visulima/path`'s `sep` is `/` on every platform), which is exactly
 * what `--prefix` wants.
 */

export interface GitExec {
    status: number;
    stderr: string;
    stdout: string;
}

export type GitRunner = (args: string[], cwd: string) => GitExec;

/** 64 MiB — large enough for `git subtree split` output on big histories. */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

export const defaultGitRunner: GitRunner = (args, cwd) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: GIT_MAX_BUFFER });

    if (result.error) {
        throw new Error(`Failed to spawn git ${args.join(" ")}: ${result.error.message}`, { cause: result.error });
    }

    return {
        status: typeof result.status === "number" ? result.status : 1,
        stderr: typeof result.stderr === "string" ? result.stderr : "",
        stdout: typeof result.stdout === "string" ? result.stdout : "",
    };
};

const formatGitError = (args: string[], exec: GitExec): string => {
    const detail = (exec.stderr || exec.stdout).trim();

    return `git ${args.join(" ")} failed (exit ${exec.status})${detail ? `:\n${detail}` : ""}`;
};

/**
 * Run a git command and return its trimmed stdout. Throws an `Error`
 * carrying the stderr (or stdout) on a non-zero exit.
 */
export const runGit = (args: string[], cwd: string, runner: GitRunner = defaultGitRunner): string => {
    const exec = runner(args, cwd);

    if (exec.status !== 0) {
        throw new Error(formatGitError(args, exec));
    }

    return exec.stdout.trim();
};

/** Throw unless `cwd` is inside a git working tree. */
export const assertGitRepo = (cwd: string, runner: GitRunner = defaultGitRunner): void => {
    const exec = runner(["rev-parse", "--is-inside-work-tree"], cwd);

    if (exec.status !== 0 || exec.stdout.trim() !== "true") {
        throw new Error(`Not a git repository: ${cwd}. Run inside a git working tree.`);
    }
};

/** True when `git status --porcelain` reports no pending changes. */
export const isWorktreeClean = (cwd: string, runner: GitRunner = defaultGitRunner): boolean => runGit(["status", "--porcelain"], cwd, runner).length === 0;

/** Throw when the working tree has uncommitted changes. */
export const assertCleanWorktree = (cwd: string, runner: GitRunner = defaultGitRunner): void => {
    if (!isWorktreeClean(cwd, runner)) {
        throw new Error("Working tree has uncommitted changes. Commit or stash them before running this command.");
    }
};

export interface SubtreeSplitInput {
    /** Prefix git inserts into rewritten commit messages (`--annotate`). */
    annotate?: string;
    /** Temporary branch to point at the split tip. */
    branch: string;
    cwd: string;
    prefix: string;
    runner?: GitRunner;
}

/**
 * `git subtree split` — rewrite the history of `prefix` onto a new
 * branch whose paths are relative to the repo root. Returns the SHA at
 * the tip of that branch.
 */
export const subtreeSplit = ({ annotate, branch, cwd, prefix, runner = defaultGitRunner }: SubtreeSplitInput): string => {
    const args = ["subtree", "split", `--prefix=${prefix}`];

    if (annotate) {
        args.push(`--annotate=${annotate}`);
    }

    args.push("-b", branch);

    runGit(args, cwd, runner);

    return runGit(["rev-parse", branch], cwd, runner);
};

export interface SubtreeAddInput {
    cwd: string;
    message?: string;
    prefix: string;
    ref: string;
    repo: string;
    runner?: GitRunner;
    squash?: boolean;
}

/**
 * `git subtree add` — merge `repo`'s history at `ref` into the working
 * tree under `prefix`, preserving the incoming commits (or collapsing
 * them to one merge commit with `--squash`). Requires a clean tree.
 */
export const subtreeAdd = ({ cwd, message, prefix, ref, repo, runner = defaultGitRunner, squash }: SubtreeAddInput): void => {
    const args = ["subtree", "add", `--prefix=${prefix}`];

    if (squash) {
        args.push("--squash");
    }

    if (message) {
        args.push("-m", message);
    }

    args.push(repo, ref);

    runGit(args, cwd, runner);
};

export interface InitRepoFromBranchInput {
    /** Branch name to create as the default branch in the new repo. */
    branch: string;
    runner?: GitRunner;
    /** Absolute path of the source repo to pull the split history from. */
    source: string;
    /** The temporary split branch inside `source`. */
    sourceBranch: string;
    /** Destination directory for the new repo (must already exist). */
    target: string;
}

/**
 * Initialise a fresh repo at `target` and pull the split history into
 * it. Pulling into the unborn `branch` fast-forwards it to the split
 * tip, so the new repo carries the full subtree history.
 */
export const initRepoFromBranch = ({ branch, runner = defaultGitRunner, source, sourceBranch, target }: InitRepoFromBranchInput): void => {
    runGit(["init", "-b", branch], target, runner);
    runGit(["pull", source, sourceBranch], target, runner);
};

/** Delete the temporary split branch (`git branch -D`). */
export const deleteBranch = (branch: string, cwd: string, runner: GitRunner = defaultGitRunner): void => {
    runGit(["branch", "-D", branch], cwd, runner);
};

/** Add a named remote (`git remote add`). */
export const addRemote = (name: string, url: string, cwd: string, runner: GitRunner = defaultGitRunner): void => {
    runGit(["remote", "add", name, url], cwd, runner);
};

/** Push a branch upstream (`git push -u`). */
export const pushBranch = (remote: string, branch: string, cwd: string, runner: GitRunner = defaultGitRunner): void => {
    runGit(["push", "-u", remote, branch], cwd, runner);
};

/** Count commits reachable from `ref` (`git rev-list --count`). */
export const countCommits = (ref: string, cwd: string, runner: GitRunner = defaultGitRunner): number => {
    const out = runGit(["rev-list", "--count", ref], cwd, runner);
    const count = Number.parseInt(out, 10);

    return Number.isNaN(count) ? 0 : count;
};

/**
 * Remove the prefix directory (`git rm -r`) then commit the deletion.
 * Used by `vis split --remove` to drop the extracted package from the
 * monorepo.
 */
export const removePathAndCommit = (prefix: string, message: string, cwd: string, runner: GitRunner = defaultGitRunner): void => {
    runGit(["rm", "-r", prefix], cwd, runner);
    runGit(["commit", "-m", message], cwd, runner);
};
