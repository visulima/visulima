/**
 * Public entry point for `@visulima/vis/release/package-managers`.
 *
 * Exposes the `PackageManagerAdapter` contract (pack / publish / install /
 * list / catalog) plus `detectPackageManager` and `createAdapter` for callers
 * composing the publish pipeline directly.
 */
export { createAdapter, detectPackageManager, type PackageManagerId } from "./detect";
export type {
    CommandRunner,
    InstallLockfileOnlyOptions,
    PackageManagerAdapter,
    PackOptions,
    PackResult,
    PublishNativeOptions,
    PublishOptions,
    PublishResult,
    WorkspaceListEntry,
} from "./interface";
