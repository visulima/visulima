/**
 * Plugin authoring SDK — one import path for everyone writing custom
 * notification channels, version actions, or changelog formatters for
 * the release subsystem.
 *
 * Without this module, plugin authors had to assemble imports from three
 * different sub-paths (`@visulima/vis/release/types`,
 * `…/core/notifications/interface`, `…/core/version-actions/interface`)
 * and infer the public interfaces by reading source files. Now:
 *
 * ```ts
 * import {
 *     defineNotificationChannel,
 *     defineVersionActions,
 *     defineChangelogFormatter,
 * } from "@visulima/vis/release/plugin-sdk";
 *
 * export default defineNotificationChannel({
 *     id: "teams",
 *     async send(context) { ... },
 * });
 * ```
 *
 * Each `define*` helper is a runtime identity function — its real value
 * is the TypeScript constraint on the input, which surfaces missing
 * fields, wrong signatures, and stale shapes at the import site rather
 * than at runtime plugin-load.
 *
 * Stability: tracks the same RFC §21.1 stability contract as the
 * subsystem — breaking changes to any helper or re-exported type
 * require a vis major version bump.
 */

import type { ChangelogFormatter } from "./core/changelog/api";
import type {
    NotificationChannel,
} from "./core/notifications/interface";
import type { VersionActions } from "./core/version-actions/interface";

// ── Notification channel ───────────────────────────────────────────

/**
 * Re-export of {@link NotificationChannel} so plugin authors get the
 * full type from a single import path.
 */

/**
 * Identity wrapper that constrains its argument to a
 * {@link NotificationChannel}. Use as the default export of a custom
 * channel module so the type-system catches missing fields (e.g. no
 * `id` / no `send`) at the import site.
 *
 * ```ts
 * export default defineNotificationChannel({
 *     id: "teams",
 *     async send(context) {
 *         await fetch(WEBHOOK, { body: JSON.stringify(context) });
 *     },
 * });
 * ```
 */
export const defineNotificationChannel = (channel: NotificationChannel): NotificationChannel => channel;

// ── Version actions ─────────────────────────────────────────────────

/**
 * Re-export the shapes a `VersionActions` implementation interacts
 * with. `PublishContext` carries everything you need at publish time
 * (the package, the resolved version, workspace + per-package config);
 * `PublishResult` is the typed return shape.
 */

/**
 * Identity wrapper that constrains its argument to a concrete
 * {@link VersionActions} subclass instance.
 *
 * Most authors will subclass `VersionActions` directly because it's an
 * abstract class with two abstract methods. `defineVersionActions` is
 * still useful as a type-narrowed default-export wrapper that surfaces
 * a clearer compile error when the subclass forgets `id` /
 * `readPublishedVersion` / `publish`:
 *
 * ```ts
 * class TeamsActions extends VersionActions {
 *     readonly id = "teams";
 *     async readPublishedVersion() { return undefined; }
 *     async publish(context: PublishContext): Promise&lt;PublishResult> { ... }
 * }
 *
 * export default defineVersionActions(new TeamsActions());
 * ```
 */
export const defineVersionActions = (actions: VersionActions): VersionActions => actions;

// ── Changelog formatter ─────────────────────────────────────────────

/**
 * Re-export of the changelog formatter contract — same shape as
 * `@visulima/vis/release/types` exposes, surfaced here so plugin authors
 * never need a second import path.
 */

/**
 * Identity wrapper around a {@link ChangelogFormatter}.
 *
 * ```ts
 * export default defineChangelogFormatter(async (context) => {
 *     return `### ${context.release.name} ${context.release.newVersion}\n…`;
 * });
 * ```
 *
 * Aliased to the historical `defineFormatter` export from
 * `core/changelog/api` so existing user code continues to type-check;
 * future plugin authors should prefer the SDK name for clarity.
 */
export const defineChangelogFormatter = (formatter: ChangelogFormatter): ChangelogFormatter => formatter;

export { type ChangelogContext, type ChangelogFormatter, type ChangelogFormatterModule, type ChangelogTarget } from "./core/changelog/api";
export { type NotificationChannel, type NotificationContext, type NotificationPackage } from "./core/notifications/interface";
export { type PublishResult } from "./core/package-managers/interface";
export { AfterAllProjectsVersioned, type AfterAllVersionedContext, type AfterAllVersionedResult, type PublishContext, VersionActions } from "./core/version-actions/interface";
