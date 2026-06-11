/**
 * Re-exports the framework-agnostic types from `core/types`.
 *
 * Historically these types lived here in the React folder, which coupled the
 * root `.` export's `.d.ts` to the React binding. They now live in `core/` and
 * are re-exported from each framework folder for backwards compatibility.
 */
export type { FileMeta, HeadersResolver, UploadItem, UploadMethod, UploadRestrictions, UploadResult } from "../core/types";
