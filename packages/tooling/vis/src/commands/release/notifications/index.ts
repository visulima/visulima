/**
 * `vis release notifications &lt;subcommand>` — dry-run notification channels
 * so operators can verify a configured slack / discord / webhook destination
 * actually works BEFORE relying on it for a real release.
 *
 * Modeled on `semantic-release --dry-run`, but scoped to the post-publish
 * notifications fan-out. Construction:
 *
 *   1. Read `release.notifications` from `vis.config.ts`.
 *   2. Build a synthetic `NotificationContext` (a believable single-package
 *      release by default; operator can override via `--custom-context`).
 *   3. Dispatch to every channel — or filter to one with `--channel=slack`
 *      / `--channel=slack:eng` for an id'd Slack hook.
 *   4. Print per-channel pass/fail. Exit 0 iff all dispatched channels
 *      succeeded.
 */

import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const notificationsOptionDefinitions = {
    action: {
        defaultOption: true,
        defaultValue: "test",
        description: "Subcommand: test",
        type: String,
    },
    channel: {
        description: "Restrict dispatch to a single channel kind (`slack`, `discord`, `webhook`) or an id'd channel (`slack:eng`)",
        type: String,
    },
    "custom-context": {
        description: "Path to a JSON file containing a NotificationContext to use instead of the synthetic default",
        type: String,
    },
    json: {
        description: "Emit machine-readable JSON instead of a per-channel report",
        type: Boolean,
    },
} as const;

const notifications = defineCommand({
    commandPath: ["release"],
    description: "Dry-run the configured notification channels (slack / discord / webhook / plugins) with a synthetic release",
    examples: [
        ["vis release notifications test", "Dispatch a fake release to every configured channel"],
        ["vis release notifications test --channel=slack", "Dispatch to every Slack channel only"],
        ["vis release notifications test --channel=slack:eng", "Dispatch to the slack channel with id=eng only"],
        ["vis release notifications test --custom-context=./fake.json", "Use operator-supplied JSON instead of the built-in synthetic release"],
        ["vis release notifications test --json", "Emit machine-readable results"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "notifications",
    options: notificationsOptionDefinitions,
});

export default notifications;

export type ReleaseNotificationsOptions = CreateOptions<{
    action: string;
    channel: string | undefined;
    "custom-context": string | undefined;
    json: boolean | undefined;
}>;
