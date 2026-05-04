export type { StartServiceInput, StartServiceResult, StopServiceInput, StopServiceResult } from "./lifecycle";
export { startService, stopService } from "./lifecycle";
export { runReadiness, ServiceReadinessError, waitForTcp } from "./readiness";
export { deleteEntry, getRegistryDir, isAlive, pruneDead, readAllEntries, readEntry, slugify, writeEntry } from "./registry";
export type { SpawnDetachedInput, SpawnDetachedResult } from "./spawn";
export { spawnDetached } from "./spawn";
export type { ServiceConfig, ServiceEntry } from "./types";
