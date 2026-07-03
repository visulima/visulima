import { StagedError } from "./staged-error";

/** Post-task commit would be empty and `--allow-empty` was not set. */
export class ApplyEmptyCommitError extends StagedError {}
