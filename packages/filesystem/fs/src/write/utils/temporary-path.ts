import { randomBytes } from "node:crypto";

/**
 * Builds an unpredictable temporary path next to `path` for atomic writes.
 *
 * Using a per-process, per-call random suffix (instead of a fixed `${path}.tmp`)
 * prevents two concurrent writers to the same target from clobbering each
 * other's temp file, and stops an attacker from pre-creating a predictable temp
 * path as a symlink in a shared-writable directory.
 * @param path The final destination path.
 * @returns A sibling temporary path with a unique, unpredictable suffix.
 */
const temporaryPath = (path: string): string => `${path}.${process.pid.toString(36)}.${randomBytes(6).toString("hex")}.tmp`;

export default temporaryPath;
