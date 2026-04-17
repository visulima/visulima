/**
 * Typed error classes surfaced by the staged workflow. Consumers can
 * switch on `instanceof` to distinguish setup failures from task/git
 * failures. Error names mirror lint-staged's where behavior overlaps.
 */

export { ApplyEmptyCommitError } from "./apply-empty-commit-error";
export { ConfigError } from "./config-error";
export { GetBackupStashError } from "./get-backup-stash-error";
export { GitError } from "./git-error";
export { RestoreOriginalStateError } from "./restore-original-state-error";
export { StagedError } from "./staged-error";
export { TaskError } from "./task-error";
