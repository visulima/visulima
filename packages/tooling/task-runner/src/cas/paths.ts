import { join } from "@visulima/path";

/**
 * v2 layout root inside the cache directory. Coexists with the legacy
 * `&lt;cacheDir>/&lt;hash>/` entries until the migration window closes.
 */
export const V2_ROOT = "v2";

/**
 * Sub-roots under `v2/`. CAS holds raw blob bytes, AC holds JSON
 * `ActionResult` entries, the task-hash index bridges xxh3 task hashes
 * to sha256 action digests, tmp stages atomic renames.
 */
export const V2_CAS = "cas";
export const V2_AC = "ac";
export const V2_INDEX = "task-hash-index";
export const V2_TMP = "tmp";

/**
 * Shard a digest into a 256-bucket subdirectory keyed by its first two
 * hex chars. Spreads filesystem load and matches `bazel-remote`'s
 * on-disk layout, so the same cache root can be served by both
 * processes if a user wants to point bazel-remote at it directly.
 */
export const shard = (hash: string): string => hash.slice(0, 2);

/**
 * Resolve the on-disk path for a CAS blob. `&lt;root>/v2/cas/&lt;aa>/&lt;hash>`.
 */
export const casBlobPath = (root: string, hash: string): string => join(root, V2_ROOT, V2_CAS, shard(hash), hash);

/**
 * Resolve the on-disk path for an Action Cache entry. AC entries are
 * JSON, suffix kept off-disk to match REAPI semantics (the action
 * digest is the file name).
 */
export const acEntryPath = (root: string, actionHash: string): string => join(root, V2_ROOT, V2_AC, shard(actionHash), `${actionHash}.json`);

/**
 * Resolve the path for the task-hash → action-digest redirect. 64-byte
 * file containing the action digest hex; lets `Cache.get(taskHash)`
 * jump to the AC entry without recomputing the action proto.
 */
export const taskHashIndexPath = (root: string, taskHash: string): string => join(root, V2_ROOT, V2_INDEX, shard(taskHash), taskHash);

/**
 * Resolve the staging directory used for tmp+rename atomic writes.
 */
export const tmpDirectory = (root: string): string => join(root, V2_ROOT, V2_TMP);
