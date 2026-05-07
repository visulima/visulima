/**
 * Centralized layout for vis's per-user filesystem state.
 *
 *   ~/.vis/
 *     cache/                  # ephemeral caches; safe to delete anytime
 *       ai/, doctor/, socket-security/
 *     state/                  # durable state across vis runs
 *       sponsor.json, tips.json, upgrade-check.json
 *     workspaces/<hash>/      # per-workspace bucket, keyed by workspace path
 *       services/             # running-service registry (PIDs, ports, logs)
 *
 * Per-workspace data is keyed by a 12-char sha256 prefix of the absolute
 * workspace root, so multiple git worktrees of the same repo each get
 * their own bucket and never collide.
 *
 * Per-package-manager workspace caches stay where they are (under
 * `<workspace>/node_modules/.cache/vis/`) — those die with `node_modules`
 * and that's the desired lifecycle.
 */

import { createHash } from "node:crypto";
import { homedir } from "node:os";

import { join } from "@visulima/path";

export const getVisHomeDir = (): string => join(homedir(), ".vis");

export const getVisCacheDir = (): string => join(getVisHomeDir(), "cache");

export const getVisStateDir = (): string => join(getVisHomeDir(), "state");

/**
 * Stable, filesystem-safe directory name for a workspace. Two checkouts of
 * the same repo (e.g. main and a `git worktree`) produce different hashes
 * because their absolute paths differ — that isolation is intentional.
 */
export const hashWorkspace = (workspaceRoot: string): string => createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);

export const getVisWorkspaceDir = (workspaceRoot: string): string => join(getVisHomeDir(), "workspaces", hashWorkspace(workspaceRoot));
