import { prunePnpmLockfile } from "./pnpm";
import type { PruneInput, PruneResult } from "./types";

/**
 * Prune `aube-lock.yaml`.
 *
 * Aube's lockfile uses the pnpm v9 YAML schema verbatim
 * (`lockfileVersion: '9.0'` with the same `importers` / `packages` /
 * `snapshots` / `catalogs` / `overrides` / `patchedDependencies`
 * layout — verified against `crates/aube-lockfile/src/pnpm.rs` and
 * `fixtures/medium/aube-lock.yaml` in github.com/endevco/aube). That
 * means the pnpm pruner is byte-compatible with aube; we just override
 * the `displayName` so success messages and parse errors mention the
 * file the user actually wrote.
 *
 * If aube's schema diverges from pnpm v9 in a future release, swap
 * this for a dedicated parser. Until then, delegating keeps the two
 * pruners in lockstep and avoids duplicating ~250 lines of
 * graph-walking logic.
 */
export const pruneAubeLockfile = (input: PruneInput): PruneResult => prunePnpmLockfile({ ...input, displayName: input.displayName ?? "aube-lock.yaml" });
