/**
 * Public entry point for `@visulima/vis/release/version-actions`.
 *
 * Plugin authors implement `VersionActions` (and optionally
 * `AfterAllProjectsVersioned`) to own a package's versioning + publish
 * lifecycle, then point a package's `versionActions` config at the module.
 * `createVersionActions` is the built-in id-to-implementation registry.
 */
export {
    AfterAllProjectsVersioned,
    type AfterAllVersionedContext,
    type AfterAllVersionedResult,
    type PublishContext,
    VersionActions,
} from "./interface";
export { createVersionActions } from "./registry";
