import { StagedError } from "./staged-error";

/** The backup stash could not be located during cleanup/revert. */
export class GetBackupStashError extends StagedError {}
