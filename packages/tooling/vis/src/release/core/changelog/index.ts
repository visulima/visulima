/**
 * Public entry point for `@visulima/vis/release/changelog`.
 *
 * Exposes the changelog formatter contract (`ChangelogFormatter` /
 * `ChangelogContext`), the `defineFormatter` authoring helper, and
 * `resolveFormatter` which maps a `release.changelog` config value
 * (`"default"`, `"github"`, `"keep-a-changelog"`, a path, a `[path, opts]`
 * tuple, or `false`) to a concrete formatter function.
 */
export {
    type ChangeFileMeta,
    type ChangelogContext,
    type ChangelogFormatter,
    type ChangelogFormatterModule,
    type ChangelogTarget,
    defineFormatter,
} from "./api";
export { resolveFormatter } from "./resolve";
