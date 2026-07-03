import { StagedError } from "./staged-error";

/** Restoring the working tree from the backup stash failed. */
export class RestoreOriginalStateError extends StagedError {}
