/**
 * Pluggable changelog formatter API (RFC §6.1.1, port from bumpy).
 *
 * Built-in formatters:
 *   - `default` — plain Markdown, dependency-bump notes inline
 *   - `github`  — adds PR / commit / author links (uses `gh` CLI when available)
 *
 * Custom: load via path or `[path, options]` tuple in vis.config.ts:
 *   `release.changelog: "./my-formatter.ts"`
 *   `release.changelog: ["./my-formatter.ts", { repo: "owner/name" }]`
 */

import type { ChangeFile, PlannedRelease } from "../../types";

export type ChangelogTarget = "changelog" | "github-release";

export interface ChangelogContext {
    /** All change files contributing to this release (may be empty for pure dep bumps). */
    changeFiles: ChangeFile[];
    /** ISO date string `YYYY-MM-DD`. */
    date: string;
    /** The release entry being rendered. */
    release: PlannedRelease;
    /** Where the rendered output is going — formatters may strip the version heading for `github-release`. */
    target: ChangelogTarget;
}

/** Function signature for changelog formatters. */
export type ChangelogFormatter = (context: ChangelogContext) => string | Promise<string>;

/** Factory shape — formatters can be exported as `defineFormatter` calls or default-exported functions. */
export type ChangelogFormatterModule = { default?: ChangelogFormatter } | ChangelogFormatter;

/** Recognised inline-metadata keys in change-file bodies. */
export interface ChangeFileMeta {
    author?: string;
    commit?: string;
    pr?: number;
}

/** Helper for custom formatters that wrap the default behaviour. */
export const defineFormatter = (formatter: ChangelogFormatter): ChangelogFormatter => formatter;
