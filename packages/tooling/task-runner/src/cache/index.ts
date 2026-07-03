/**
 * Subpath entry: `@visulima/task-runner/cache`.
 *
 * The local cache façade plus the CAS (content-addressable store)
 * primitives it sits on. Importing this subpath avoids pulling in the
 * concurrent runner, task graph, and scheduler code.
 */

export type { CachedResult, CacheOptions } from "../cache";
export { Cache, DEFAULT_CACHE_DIRECTORY_NAME, formatCacheSize, parseCacheSize } from "../cache";
// CAS primitives (v2 layout: digest helpers, sharded paths, blob/AC store).
export { digestBuffer, digestFile } from "../cas/digest";
export { acEntryPath, casBlobPath, taskHashIndexPath, V2_AC, V2_CAS, V2_INDEX, V2_ROOT, V2_TMP } from "../cas/paths";
export { containsBlob, fetchBlobToFile, putBlobFromBytes, putBlobFromFile, touchBlob, verifyBlob } from "../cas/store";
