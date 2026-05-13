import { spawnSync } from "node:child_process";

/**
 * Modes for collecting candidate files prior to per-hook filtering.
 *
 *   - `staged`: pre-commit-style; `git diff --cached` with ACM filter
 *   - `all`:    `--all-files` equivalent; `git ls-files`
 *   - `range`:  `--from-ref/--to-ref`; `git diff &lt;from>..&lt;to>` with ACM
 */
export type DiscoverMode
    = | { kind: "all" }
        | { fromRef: string; kind: "range"; toRef: string }
        | { kind: "staged" };

/**
 * Split a NUL-delimited git output buffer into filenames. We walk the
 * buffer byte-by-byte instead of decoding it as UTF-8 first because
 * git happily produces non-UTF-8 paths (legacy encodings, Latin-1 from
 * macOS HFS+ migrations), and a one-shot `toString("utf8")` would
 * silently replace those bytes with U+FFFD before we can hand them
 * back to the OS.
 */
const splitNulBuffer = (buf: Buffer): string[] => {
    const result: string[] = [];
    let start = 0;

    for (let i = 0; i < buf.length; i += 1) {
        if (buf[i] === 0x00) {
            if (i > start) {
                result.push(buf.subarray(start, i).toString("utf8"));
            }

            start = i + 1;
        }
    }

    if (start < buf.length) {
        result.push(buf.subarray(start).toString("utf8"));
    }

    return result;
};

const gitListFiles = (args: ReadonlyArray<string>, errorHint: string, root: string): string[] => {
    const result = spawnSync("git", [...args], { cwd: root, encoding: "buffer" });

    if (result.status !== 0) {
        const stderr = result.stderr ? result.stderr.toString() : "";

        throw new Error(`git ${errorHint} failed${stderr ? `: ${stderr.trim()}` : ""}`);
    }

    if (result.stdout.length === 0) {
        return [];
    }

    return splitNulBuffer(result.stdout);
};

/**
 * Resolve the candidate file set for the current invocation. Uses `-z`
 * everywhere because filenames with newlines do appear in the wild and
 * pre-commit/prek both handle them.
 */
export const discoverFiles = (mode: DiscoverMode, root: string): string[] => {
    switch (mode.kind) {
        case "all": {
            return gitListFiles(["ls-files", "-z"], "ls-files", root);
        }
        case "range": {
            return gitListFiles(["diff", "--name-only", "--diff-filter=ACM", "-z", mode.fromRef, mode.toRef], "diff --from-ref/--to-ref", root);
        }
        case "staged": {
            return gitListFiles(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"], "diff --cached", root);
        }
        default: {
            const unreachable: never = mode;

            throw new Error(`unknown discover mode: ${JSON.stringify(unreachable)}`);
        }
    }
};
