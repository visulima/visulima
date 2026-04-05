/**
 * Git clone action — clones a repository (or subdirectory / single file)
 * into a target directory, without the .git folder.
 *
 * Strategy:
 * 1. `git clone --depth 1 --single-branch` into a temp dir (fast, shallow)
 * 2. If shallow clone fails (e.g. commit hash), fall back to full clone + checkout
 * 3. Copy the requested path (full repo, subdir, or single file) to the target
 * 4. Clean up the temp dir
 *
 * Ported from gitpick (MIT) — adapted for vis with synchronous API.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { info, warn } from "../../../output";
import type { GitRepoConfig } from "./parse-url";

// ── Directory copy (skip .git) ────────────────────────────────────

/**
 * Recursively copy a directory, skipping `.git` folders.
 */
const copyDir = (src: string, dest: string): void => {
    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === ".git") {
            continue;
        }

        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            cpSync(srcPath, destPath);
        }
    }
};

// ── Clone ─────────────────────────────────────────────────────────

export interface CloneOptions {
    /** Print progress info. */
    verbose?: boolean;
}

/**
 * Clone a git repository (or a subdirectory / file within it) into `targetPath`.
 *
 * Returns 0 on success, non-zero on failure.
 */
export const cloneRepo = (
    config: GitRepoConfig,
    targetPath: string,
    options: CloneOptions = {},
): number => {
    const repoUrl = `https://${config.token ? config.token + "@" : ""}${config.host}/${config.owner}/${config.repository}.git`;
    const displayUrl = `https://${config.host}/${config.owner}/${config.repository}`;

    const tempDir = resolve(
        tmpdir(),
        `vis-clone-${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
    );

    try {
        if (options.verbose) {
            info(`Cloning ${displayUrl} @ ${config.branch}...`);
        }

        // Try shallow clone first (fast)
        let cloneOk = shallowClone(repoUrl, tempDir, config.branch);

        if (!cloneOk) {
            // Shallow clone can fail for commit hashes — fall back to full clone
            if (options.verbose) {
                warn("Shallow clone failed, trying full clone...");
            }

            cleanup(tempDir);
            cloneOk = fullClone(repoUrl, tempDir, config.branch);
        }

        if (!cloneOk) {
            warn(`Failed to clone ${displayUrl}`);
            return 1;
        }

        // Resolve the source path within the cloned repo
        const sourcePath = config.path ? resolve(tempDir, config.path) : tempDir;

        if (!existsSync(sourcePath)) {
            warn(`Path "${config.path}" not found in ${displayUrl}@${config.branch}`);
            return 1;
        }

        const stat = statSync(sourcePath);

        if (stat.isDirectory()) {
            // Copy the directory (or full repo) to target
            copyDir(sourcePath, targetPath);
        } else {
            // Single file — copy it
            mkdirSync(dirname(targetPath), { recursive: true });
            cpSync(sourcePath, targetPath);
        }

        return 0;
    } finally {
        // Always clean up the temp dir
        cleanup(tempDir);
    }
};

// ── Clone strategies ──────────────────────────────────────────────

const shallowClone = (repoUrl: string, tempDir: string, branch: string): boolean => {
    const result = spawnSync("git", [
        "clone",
        repoUrl,
        tempDir,
        "--branch",
        branch,
        "--depth",
        "1",
        "--single-branch",
    ], {
        stdio: "pipe",
        timeout: 60_000,
    });

    return result.status === 0;
};

const fullClone = (repoUrl: string, tempDir: string, branch: string): boolean => {
    const cloneResult = spawnSync("git", ["clone", repoUrl, tempDir], {
        stdio: "pipe",
        timeout: 120_000,
    });

    if (cloneResult.status !== 0) {
        return false;
    }

    const checkoutResult = spawnSync("git", ["checkout", branch], {
        cwd: tempDir,
        stdio: "pipe",
    });

    return checkoutResult.status === 0;
};

const cleanup = (dir: string): void => {
    try {
        if (existsSync(dir)) {
            rmSync(dir, { force: true, recursive: true });
        }
    } catch {
        // Best-effort cleanup
    }
};
