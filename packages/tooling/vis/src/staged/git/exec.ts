import { execa } from "execa";

import { GitError } from "../errors";

export interface GitExecOptions {
    readonly cwd: string;
    /** Environment overrides merged on top of `process.env`. */
    readonly env?: Record<string, string>;
    /** Pipe stdin as a Buffer (used for `git apply`). */
    readonly input?: Buffer | string;
    /** Ignore non-zero exit codes; useful for `rev-parse` checks. */
    readonly lenient?: boolean;
}

export interface GitExecResult {
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
}

const MAX_STDERR_PREVIEW = 2048;

/** Runs `git` with the given args. Throws `GitError` on non-zero unless `lenient`. */
export const git = async (args: ReadonlyArray<string>, options: GitExecOptions): Promise<GitExecResult> => {
    const result = await execa("git", [...args], {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : undefined,
        input: options.input,
        reject: false,
        stderr: "pipe",
        stdin: options.input === undefined ? "ignore" : "pipe",
        stdout: "pipe",
    });

    const exitCode = typeof result.exitCode === "number" ? result.exitCode : 1;

    if (exitCode !== 0 && !options.lenient) {
        const stderr = typeof result.stderr === "string" ? result.stderr : "";
        const preview = stderr.length > MAX_STDERR_PREVIEW ? `${stderr.slice(0, MAX_STDERR_PREVIEW)}…` : stderr;

        throw new GitError(`git ${args.join(" ")} failed with exit code ${exitCode}: ${preview.trim()}`, stderr);
    }

    return {
        exitCode,
        stderr: typeof result.stderr === "string" ? result.stderr : "",
        stdout: typeof result.stdout === "string" ? result.stdout : "",
    };
};

/** Convenience: returns trimmed stdout from a successful git invocation. */
export const gitOut = async (args: ReadonlyArray<string>, options: GitExecOptions): Promise<string> => {
    const { stdout } = await git(args, options);

    return stdout.trim();
};

/** Returns true if `cwd` is inside a git working tree. */
export const isGitRepo = async (cwd: string): Promise<boolean> => {
    const result = await git(["rev-parse", "--is-inside-work-tree"], { cwd, lenient: true });

    return result.exitCode === 0 && result.stdout.trim() === "true";
};

/** Returns the absolute path to the repository's `.git` directory. */
export const getGitDirectory = async (cwd: string): Promise<string> => gitOut(["rev-parse", "--absolute-git-dir"], { cwd });

/** Returns the absolute path to the working-tree root. */
export const getWorkTree = async (cwd: string): Promise<string> => gitOut(["rev-parse", "--show-toplevel"], { cwd });

/** Returns the current index tree sha (via `git write-tree`). */
export const writeIndexTree = async (cwd: string): Promise<string> => gitOut(["write-tree"], { cwd });

/** Returns the tree sha for `HEAD`. Empty string when there is no commit yet. */
export const headTreeSha = async (cwd: string): Promise<string> => {
    const result = await git(["rev-parse", "HEAD^{tree}"], { cwd, lenient: true });

    return result.exitCode === 0 ? result.stdout.trim() : "";
};

/** Minimum git version required by the staged workflow — matches lint-staged v17. */
export const MIN_GIT_VERSION = { major: 2, minor: 32 } as const;

/**
 * Parses `git --version` output (e.g. `git version 2.45.1.windows.2`) into a
 * `{ major, minor }` tuple. Returns `null` when the shape isn't recognised.
 */
export const parseGitVersion = (output: string): { major: number; minor: number } | null => {
    const match = /git version (\d+)\.(\d+)/.exec(output);

    if (!match) {
        return null;
    }

    const major = Number.parseInt(match[1] ?? "", 10);
    const minor = Number.parseInt(match[2] ?? "", 10);

    if (Number.isNaN(major) || Number.isNaN(minor)) {
        return null;
    }

    return { major, minor };
};

/** Throws `GitError` when the installed git is older than {@link MIN_GIT_VERSION}. */
export const assertGitVersion = async (cwd: string): Promise<void> => {
    const version = parseGitVersion(await gitOut(["--version"], { cwd }));

    if (version === null) {
        return;
    }

    const tooOld = version.major < MIN_GIT_VERSION.major || (version.major === MIN_GIT_VERSION.major && version.minor < MIN_GIT_VERSION.minor);

    if (tooOld) {
        throw new GitError(`Git ${MIN_GIT_VERSION.major}.${MIN_GIT_VERSION.minor} or newer is required; found ${version.major}.${version.minor}.`);
    }
};
