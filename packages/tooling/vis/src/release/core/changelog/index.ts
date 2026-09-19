/**
 * Public entry point for `@visulima/vis/release/changelog`.
 *
 * Exposes the changelog formatter contract (`ChangelogFormatter` /
 * `ChangelogContext`), the `defineFormatter` authoring helper, the
 * conventional-commit primitives the built-in formatters share
 * (`parseConventionalHeader`, `renderGroupedEntries`, `renderReleaseHeading`),
 * and `resolveFormatter` which maps a `release.changelog` config value
 * (`"default"`, `"github"`, `"keep-a-changelog"`, `"conventional"`, a path, a
 * `[path, opts]` tuple, or `false`) to a concrete formatter function.
 */
export {
    type ChangeFileMeta,
    type ChangelogContext,
    type ChangelogFormatter,
    type ChangelogFormatterModule,
    type ChangelogTarget,
    defineFormatter,
} from "./api";
export { type ConventionalFormatterOptions, createConventionalFormatter, DEFAULT_CONVENTIONAL_HEADING } from "./conventional";
export { hasBulletMarker, isBreakingChange, parseConventionalHeader, type ParsedConventionalHeader, stripBulletMarker } from "./conventional-header";
export { buildCompareUrl, type CompareUrlInput, type ReleaseHeadingTokens, renderReleaseHeading } from "./release-heading";
export { resolveFormatter } from "./resolve";
export {
    type ConventionalTypeRule,
    DEFAULT_BREAKING_SECTION,
    DEFAULT_CONVENTIONAL_TYPES,
    DEFAULT_UNCATEGORIZED_SECTION,
    type EntryStyle,
    type GroupableEntry,
    renderGroupedEntries,
    type RenderGroupedOptions,
    UNCATEGORIZED_TYPE,
} from "./sections";
