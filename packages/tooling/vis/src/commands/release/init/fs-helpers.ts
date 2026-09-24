/**
 * Filesystem + text helpers shared by the `vis release init` lanes.
 *
 * Reads and writes go through the injected `CerebroFs` rather than
 * `node:fs/promises` so the command stays runnable under an in-memory
 * adapter (tests) or a sandboxed runtime (MCP / JustBash).
 *
 * Two rules the whole command depends on live here:
 *
 *   - **Only a confirmed "not found" counts as absent.** Every caller reads
 *     "missing" as permission to create the file. Folding an `EACCES` or an
 *     `EISDIR` into the same answer turns an unreadable `.gitignore` into a
 *     brand-new one, silently destroying its contents — so anything that is
 *     not `ENOENT`/`ENOTDIR` propagates and stops the run.
 *   - **A write never follows a symlink.** `access()`/`stat()` say "missing"
 *     for a dangling symlink while `writeFile()` happily follows it, so a
 *     write aimed at `.vis/release/x.md` can land wherever the link points.
 *     {@link writeFileNoFollow} refuses that instead.
 */

import { lstat } from "node:fs/promises";

import type { CerebroFs } from "@visulima/cerebro";

import { VisUserError } from "../../../errors/vis-user-error";

/** Errno codes that mean "this path does not exist", and nothing else. */
const NOT_FOUND_CODES: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR"]);

/**
 * `true` only for a confirmed not-found failure.
 *
 * Everything else — `EACCES`, `EISDIR`, `EIO`, `EPERM`, … — is a real error
 * that has to reach the operator rather than being reported as an absent
 * file, because "absent" is what licenses this command to write.
 */
export const isNotFoundError = (error: unknown): boolean => NOT_FOUND_CODES.has((error as NodeJS.ErrnoException | undefined)?.code ?? "");

/**
 * A `CerebroFs` adapter that can answer the no-follow question itself.
 *
 * `CerebroFs` (cerebro 3.1) exposes no `lstat`, so this is duck-typed rather
 * than required: an adapter that grows one is used, and one that has not is
 * handled by {@link isSymbolicLink}'s fallback.
 */
type NoFollowCapableFs = CerebroFs & { lstat?: (path: string) => Promise<{ isSymbolicLink: () => boolean }> };

/**
 * `true` when `path` is a symlink — including a dangling one, which is the
 * case `access()` and `stat()` both report as "missing".
 *
 * The injected adapter answers when it can. Otherwise the probe falls back to
 * the host filesystem, which is the same escape hatch the TTY probe in
 * `semantic-release.ts` uses and is safe for an in-memory adapter: its paths
 * are not on the host filesystem, so the fallback answers "not a symlink" —
 * which is exactly right, since an in-memory tree has no symlinks to follow.
 *
 * This is a guard, never a data source. It only ever decides whether a write
 * is allowed to proceed.
 */
export const isSymbolicLink = async (fs: CerebroFs, path: string): Promise<boolean> => {
    const adapterLstat = (fs as NoFollowCapableFs).lstat;

    try {
        const stats = typeof adapterLstat === "function" ? await adapterLstat.call(fs, path) : await lstat(path);

        return stats.isSymbolicLink();
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }

        throw error;
    }
};

/**
 * Write `data` to `path`, refusing to follow a symlink planted at the target.
 *
 * Every write this command makes is a check-then-write: it reads the file (or
 * probes for it), decides the file is missing or needs an edit, and writes.
 * A symlink at the target turns that into a write *through* the link — into
 * `~/.ssh/authorized_keys`, say — for anyone who can plant one in the repo
 * before `vis release init` runs on it.
 *
 * Refusing is deliberately not the same as an exclusive create: the probe and
 * the write are still two calls, so a file created in between is overwritten.
 * Closing that window needs an `O_EXCL|O_NOFOLLOW` create, which `CerebroFs`
 * cannot express — see the comment on the symlink rule in the module header.
 */
export const writeFileNoFollow = async (fs: CerebroFs, path: string, data: string): Promise<void> => {
    if (await isSymbolicLink(fs, path)) {
        throw new VisUserError(
            `Refusing to write ${path}: it is a symlink, and following it would write somewhere else. Remove or replace the link, then re-run.`,
        );
    }

    await fs.writeFile(path, data);
};

/** `true` when `path` is reachable — the `access()` idiom, minus the throw. */
export const fileExists = async (fs: CerebroFs, path: string): Promise<boolean> => {
    try {
        await fs.access(path);

        return true;
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }

        throw error;
    }
};

/** `true` when `path` exists and is a directory. */
export const isDirectory = async (fs: CerebroFs, path: string): Promise<boolean> => {
    try {
        const stats = await fs.stat(path);

        return stats.isDirectory();
    } catch (error) {
        if (isNotFoundError(error)) {
            return false;
        }

        throw error;
    }
};

/** Read a UTF-8 file, or `undefined` when it does not exist. */
export const readTextFile = async (fs: CerebroFs, path: string): Promise<string | undefined> => {
    try {
        return await fs.readFile(path, "utf8");
    } catch (error) {
        if (isNotFoundError(error)) {
            return undefined;
        }

        throw error;
    }
};

/**
 * The indent unit `source` is written with.
 *
 * The first indented line of a pretty-printed document sits exactly one level
 * deep, so its leading whitespace *is* the unit. A single-line document has no
 * indent to detect and stays compact; anything else falls back to four spaces
 * (the monorepo default).
 */
export const detectIndent = (source: string): string => {
    const match = /\n([\t ]+)\S/.exec(source);

    if (match?.[1] !== undefined) {
        return match[1];
    }

    return source.includes("\n") ? "    " : "";
};

/**
 * Re-serialise `value` in the style of the `source` text it came from —
 * same indent unit, same line endings, same trailing-newline habit.
 *
 * Without this a `JSON.stringify(value, undefined, 4)` write reformats every
 * line of a 2-space `package.json`, turning a one-key addition into a
 * whole-file diff.
 */
export const serialiseJsonLike = (value: unknown, source: string): string => {
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    const body = JSON.stringify(value, undefined, detectIndent(source)).replaceAll("\n", eol);

    return source.endsWith("\n") ? `${body}${eol}` : body;
};
