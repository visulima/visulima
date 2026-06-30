/**
 * `@visulima/vis/release` — programmatic API for the vis release subsystem.
 *
 * See `packages/tooling/vis/rfc/design-release-manager.md` for the full design.
 *
 * Stability: every export here is part of vis's public API surface — breaking
 * changes require a vis major version bump (RFC §21.1).
 */

export type {
    ChangelogOptions,
    ChangelogResult,
    PublishOptions,
    PublishResult,
    ReleaseDraft,
    ReleaseOptions,
    ReleaseOptionsBase,
    SnapshotOptions,
    SnapshotResult,
    VersionOptions,
    VersionResult,
} from "./api";
export { release, releaseChangelog, ReleaseClient, releaseDraft, releasePublish, releaseSnapshot, releaseVersion } from "./api";
export { DEFAULT_CLEAN_KEEP, DEFAULT_CLEAN_STRIP, DEFAULT_CONFIG, DEFAULT_DEPENDENCY_BUMP_RULES, defineReleaseConfig, resolveCleanStripList } from "./config";
export { defineReleasePlugin } from "./core/plugins";
export type { VisReleaseErrorCode, VisReleaseErrorOptions } from "./errors";
export { VisReleaseError, visReleaseError } from "./errors";
export type {
    BumpAs,
    BumpLevel,
    BumpReason,
    BumpSource,
    CatalogResolutionMode,
    ChangeFile,
    ChangeFileNested,
    ChangeFileSimple,
    ChannelConfig,
    ChannelMode,
    CleanPackageJsonConfig,
    DependencyBumpRule,
    DependencyBumpRules,
    DependencyKind,
    DependentInfo,
    GitUserConfig,
    LockInfo,
    PackageManifest,
    PackManager,
    PerPackageReleaseConfig,
    PlannedRelease,
    PluginPackageInfo,
    PluginPublishSummary,
    ProtocolResolutionMode,
    PublishConfig,
    PublishGuardsConfig,
    PublishStrategy,
    ReleaseAssetsConfig,
    ReleasePlan,
    ReleasePlugin,
    ReleasePluginContext,
    ReplayCondition,
    SnapshotBackend,
    SnapshotConfig,
    SnapshotTagKind,
    StateFile,
    SuccessWalkConfig,
    UpdateInternalDependenciesMode,
    VersionPrConfig,
    VisReleaseConfig,
    WorkspacePackage,
} from "./types";
export { BUMP_LEVELS, bumpRank, maxBump } from "./types";
