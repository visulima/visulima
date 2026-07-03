// Git-history scan — gitleaks `git` mode parity.
//
// `scan`/`scanFiles`/`scanString` only ever see the working tree. A secret
// that was committed and later removed is invisible to them, yet it still
// lives in the repository's history (and in every clone). This module walks a
// commit range via git plumbing (`git rev-list` → `git diff-tree` →
// `git show`), feeds every added/modified blob through the existing
// `scanString` detector, and annotates each finding with the commit it came
// from.
//
// Design notes:
//   - We shell out to the `git` binary via `execFile` with array args (no
//     shell, no injection surface). Ranges/refs are passed verbatim as args;
//     a leading `-`/`--` is rejected so a malicious ref can't smuggle a flag.
//   - Output uses NUL (`-z`) record separators wherever git supports it so
//     filenames with spaces/newlines parse unambiguously.
//   - Each historical blob is scanned independently through `scanString`,
//     reusing the whole post-process pipeline (heuristics, checksum, baseline,
//     validation). The blob's path at that commit is used as the synthetic
//     `file`, so fingerprints/baselines line up with a working-tree scan.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { scanString } from "./scan-string";
import type { Finding, ScanOptions } from "./types";

const execFileAsync = promisify(execFile);

/** Metadata about the commit a historical finding was discovered in. */
export interface GitCommitInfo {
    /** Author email (`%ae`). */
    authorEmail: string;
    /** Author name (`%an`). */
    authorName: string;
    /** Author date, ISO-8601 strict (`%aI`). */
    date: string;
    /** First line of the commit message (`%s`). */
    message: string;
    /** Full 40-char commit SHA. */
    sha: string;
}

/**
 * A {@link Finding} discovered while scanning git history, carrying the commit
 * it originated from. `file` is the blob's path at that commit.
 */
export interface GitFinding extends Finding {
    commit: GitCommitInfo;
}

export interface GitScanOptions extends ScanOptions {
    /** Repository working directory. Defaults to `process.cwd()`. */
    cwd?: string;

    /**
     * Cap the number of commits walked (most-recent first). Maps to
     * `git rev-list --max-count`. Unset = no limit.
     */
    maxCommits?: number;

    /**
     * Raw rev-list range/argument (e.g. `"main..feature"`, `"HEAD~10..HEAD"`,
     * or a single ref). Takes precedence over `since`/`until`. When neither
     * `range` nor `since`/`until` is set, the entire reachable history of
     * `HEAD` is scanned.
     */
    range?: string;

    /**
     * Lower bound of the commit range (a ref/SHA), exclusive — git range
     * semantics. Produces `since..until`. Ignored when `range` is set.
     */
    since?: string;

    /**
     * Inclusive upper bound of the commit range (a ref/SHA). Combined with
     * `since` produces `since..until`. Defaults to `HEAD` when only `since`
     * is given. Ignored when `range` is set.
     */
    until?: string;
}

const NUL = "\0";

/**
 * Reject an argument that git would interpret as an option. Refs/ranges are
 * user-supplied; a value starting with `-` could otherwise smuggle a flag
 * (e.g. `--output=…`) into the plumbing call.
 */
const assertNotFlag = (value: string, label: string): void => {
    if (value.startsWith("-")) {
        throw new Error(`secret-scanner: git ${label} "${value}" looks like a flag; refusing to pass it to git.`);
    }
};

/**
 * Resolve the rev-list range argument from the option shape. Returns the
 * single string git understands, or `undefined` for "all reachable history".
 */
const resolveRange = (options: GitScanOptions | undefined): string | undefined => {
    if (options?.range !== undefined && options.range !== "") {
        assertNotFlag(options.range, "range");

        return options.range;
    }

    if (options?.since !== undefined && options.since !== "") {
        assertNotFlag(options.since, "since");

        const until = options.until !== undefined && options.until !== "" ? options.until : "HEAD";

        assertNotFlag(until, "until");

        return `${options.since}..${until}`;
    }

    if (options?.until !== undefined && options.until !== "") {
        assertNotFlag(options.until, "until");

        return options.until;
    }

    return undefined;
};

// Git reads these from the environment and lets them override the repository
// implied by `cwd`. If the caller runs inside a git hook (or otherwise has them
// set), an inherited GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE would silently point
// our plumbing at the wrong repository. Strip them so `cwd` is authoritative.
const GIT_REPO_ENV_KEYS = new Set(["GIT_COMMON_DIR", "GIT_DIR", "GIT_INDEX_FILE", "GIT_NAMESPACE", "GIT_OBJECT_DIRECTORY", "GIT_WORK_TREE"]);

const scrubbedGitEnv = (): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(process.env).filter(([key]) => !GIT_REPO_ENV_KEYS.has(key)));

const runGit = async (gitArguments: string[], cwd: string): Promise<string> => {
    const { stdout } = await execFileAsync("git", gitArguments, {
        cwd,
        env: scrubbedGitEnv(),
        // History blobs can be large; lift the default 1 MiB cap generously.
        maxBuffer: 256 * 1024 * 1024,
        windowsHide: true,
    });

    return stdout;
};

/**
 * Enumerate the commits in range, newest-first, with their metadata. Uses a
 * NUL-delimited custom format so messages with embedded newlines don't break
 * the parse.
 */
const listCommits = async (range: string | undefined, options: GitScanOptions | undefined, cwd: string): Promise<GitCommitInfo[]> => {
    // Field order matches the destructuring below. `%x00` is a literal NUL
    // between fields; we end each record with a NUL too and split on it.
    const format = ["%H", "%an", "%ae", "%aI", "%s"].join("%x00");
    const gitArguments = ["rev-list", "--no-commit-header", `--format=${format}`];

    if (options?.maxCommits !== undefined && Number.isInteger(options.maxCommits) && options.maxCommits > 0) {
        gitArguments.push(`--max-count=${options.maxCommits}`);
    }

    gitArguments.push(range ?? "HEAD", "--");

    const stdout = await runGit(gitArguments, cwd);
    const commits: GitCommitInfo[] = [];

    // `--no-commit-header` + `--format` emits one record per commit; records
    // are newline-separated, fields within a record are NUL-separated.
    for (const record of stdout.split("\n")) {
        if (record === "") {
            continue;
        }

        const [sha, authorName, authorEmail, date, message] = record.split(NUL);

        if (sha === undefined || sha === "") {
            continue;
        }

        commits.push({
            authorEmail: authorEmail ?? "",
            authorName: authorName ?? "",
            date: date ?? "",
            message: message ?? "",
            sha,
        });
    }

    return commits;
};

/**
 * List the paths added or modified in a single commit (vs its first parent;
 * root commits diff against the empty tree). Deletions are skipped — there is
 * no post-deletion blob to scan, and the secret was already caught in the
 * commit that introduced it.
 */
const listChangedPaths = async (sha: string, cwd: string): Promise<string[]> => {
    // `diff-tree -r` walks subtrees; `--root` diffs the initial commit against
    // the empty tree so its files are included. `--diff-filter=AMR` keeps
    // Added/Modified/Renamed (the rename's new path), drops Deleted.
    const stdout = await runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "--diff-filter=AMR", "-z", sha], cwd);

    return stdout.split(NUL).filter((path) => path !== "");
};

/** Read a single blob's content at a commit. Returns `undefined` if it can't be read (e.g. binary/gone). */
const readBlob = async (sha: string, path: string, cwd: string): Promise<string | undefined> => {
    try {
        return await runGit(["show", `${sha}:${path}`], cwd);
    } catch {
        return undefined;
    }
};

/**
 * Scan a range of git history for secrets. Walks each commit, runs the secret
 * detector over every added/modified blob at that commit, and returns the
 * findings annotated with their originating commit.
 *
 * With no range options the **entire reachable history of `HEAD`** is scanned —
 * use `range`, `since`/`until`, or `maxCommits` to bound it. Scanning is
 * sequential per commit (git plumbing is the bottleneck); the existing
 * `ScanOptions` (rules, heuristics, baseline, redact, validate) all apply per
 * blob via the shared post-process pipeline.
 * @throws if `git` is not on PATH or `cwd` is not a git repository.
 */
export const scanGitHistory = async (options?: GitScanOptions): Promise<GitFinding[]> => {
    const cwd = options?.cwd ?? process.cwd();
    const range = resolveRange(options);
    const commits = await listCommits(range, options, cwd);
    const results: GitFinding[] = [];

    for (const commit of commits) {
        // eslint-disable-next-line no-await-in-loop -- Sequential by design: git plumbing (rev-list/diff-tree/show) is the bottleneck and serialising keeps memory bounded over long histories.
        const paths = await listChangedPaths(commit.sha, cwd);

        for (const path of paths) {
            // eslint-disable-next-line no-await-in-loop -- Same rationale: one blob at a time keeps a deep history from buffering every revision in memory at once.
            const content = await readBlob(commit.sha, path, cwd);

            if (content === undefined || content === "") {
                continue;
            }

            // eslint-disable-next-line no-await-in-loop -- Detection is sync for string input; the await is for the optional validator stage and we intentionally process blobs serially.
            const findings = await scanString(content, path, options);

            for (const finding of findings) {
                results.push({ ...finding, commit });
            }
        }
    }

    return results;
};
