/**
 * Lifecycle-plugin hook runners (tegami parity).
 *
 * Iterates `release.plugins[]` and invokes each hook in array order. Error
 * policy mirrors the `ReleasePlugin` contract:
 *
 *   - `applyDraft` / `willPublish` throw-propagate — they gate the release, so a
 *     failure should abort fast rather than half-apply or publish anyway.
 *   - `afterPublish` / `afterPublishAll` are post-effect — a throw is logged to
 *     stderr and swallowed; a docs-push hiccup must never "unpublish" a package.
 */

import type { PluginPackageInfo, PluginPublishSummary, ReleasePlan, ReleasePluginContext } from "../types";

const pluginsOf = (context: ReleasePluginContext): NonNullable<ReleasePluginContext["config"]["plugins"]> => context.config.plugins ?? [];

/** Run `applyDraft` for every plugin. Throws propagate (gating hook). */
export const runApplyDraftHooks = async (context: ReleasePluginContext, plan: ReleasePlan): Promise<void> => {
    for (const plugin of pluginsOf(context)) {
        if (plugin.applyDraft) {
            await plugin.applyDraft({ ...context, plan });
        }
    }
};

export interface WillPublishVerdict {
    /** Name of the plugin that vetoed, when skipped. */
    by?: string;
    skip: boolean;
}

/** Run `willPublish` for every plugin. First plugin returning `false` vetoes the publish. Throws propagate. */
export const runWillPublishHooks = async (context: ReleasePluginContext, pkg: PluginPackageInfo): Promise<WillPublishVerdict> => {
    for (const plugin of pluginsOf(context)) {
        if (!plugin.willPublish) {
            continue;
        }

        const verdict = await plugin.willPublish({ ...context, package: pkg });

        if (verdict === false) {
            return { by: plugin.name, skip: true };
        }
    }

    return { skip: false };
};

/** Run `afterPublish` for every plugin. Errors are logged, not fatal (post-effect). */
export const runAfterPublishHooks = async (context: ReleasePluginContext, pkg: PluginPackageInfo): Promise<void> => {
    for (const plugin of pluginsOf(context)) {
        if (!plugin.afterPublish) {
            continue;
        }

        try {
            await plugin.afterPublish({ ...context, package: pkg });
        } catch (error) {
            process.stderr.write(`[vis release] plugin "${plugin.name}" afterPublish(${pkg.name}) failed: ${(error as Error).message}\n`);
        }
    }
};

/** Run `afterPublishAll` for every plugin. Errors are logged, not fatal (post-effect). */
export const runAfterPublishAllHooks = async (context: ReleasePluginContext, summary: PluginPublishSummary): Promise<void> => {
    for (const plugin of pluginsOf(context)) {
        if (!plugin.afterPublishAll) {
            continue;
        }

        try {
            await plugin.afterPublishAll({ ...context, result: summary });
        } catch (error) {
            process.stderr.write(`[vis release] plugin "${plugin.name}" afterPublishAll failed: ${(error as Error).message}\n`);
        }
    }
};

/** Type-narrowing identity helper for authoring plugins (mirrors define* family). */
export const defineReleasePlugin = <T extends { name: string }>(plugin: T): T => plugin;
