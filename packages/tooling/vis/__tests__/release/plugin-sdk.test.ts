/**
 * Coverage for `@visulima/vis/release/plugin-sdk`.
 *
 * Two responsibilities:
 *   1. Runtime — the `define*` helpers are identity functions; whatever
 *      you pass in is what you get back, verbatim.
 *   2. Compile-time — the helpers narrow the input so TypeScript
 *      catches missing fields at the import site. Type-level
 *      guarantees are enforced by `lint:types` rather than vitest, but
 *      we still run a few `// \@ts-expect-error` smoke checks here so a
 *      regression surfaces in the test output instead of buried inside
 *      a tsc trace.
 */

import { describe, expect, it } from "vitest";

import type {
    ChangelogFormatter,
    NotificationChannel,
    PublishContext,
    PublishResult,
} from "../../src/release/plugin-sdk";
import {
    defineChangelogFormatter,
    defineNotificationChannel,
    defineVersionActions,
    VersionActions,
} from "../../src/release/plugin-sdk";

describe(defineNotificationChannel, () => {
    it("returns the input unchanged (identity)", () => {
        const channel: NotificationChannel = {
            id: "teams",
            send: async () => undefined,
        };

        expect(defineNotificationChannel(channel)).toBe(channel);
    });

    it("preserves the `id` + `send` shape at runtime", async () => {
        let captured: { name: string }[] = [];
        const channel = defineNotificationChannel({
            id: "test",
            send: async (context) => {
                captured = context.published.map((p) => { return { name: p.name }; });
            },
        });

        await channel.send({
            completedAt: new Date().toISOString(),
            published: [{ name: "@scope/pkg", version: "1.0.0" }],
            skipped: [],
        });

        expect(captured).toStrictEqual([{ name: "@scope/pkg" }]);
    });
});

describe(defineVersionActions, () => {
    it("returns the same VersionActions instance (identity)", () => {
        class FakeActions extends VersionActions {
            public readonly id = "fake" as const;

            public async readPublishedVersion(): Promise<string | undefined> {
                return undefined;
            }

            public async publish(_context: PublishContext): Promise<PublishResult> {
                return { output: "noop", published: true };
            }
        }

        const instance = new FakeActions();

        expect(defineVersionActions(instance)).toBe(instance);
    });
});

describe(defineChangelogFormatter, () => {
    it("returns the same function (identity)", () => {
        const formatter: ChangelogFormatter = (context) => `# ${context.release.name}`;

        expect(defineChangelogFormatter(formatter)).toBe(formatter);
    });

    it("rendered output passes through verbatim", async () => {
        const formatter = defineChangelogFormatter(async (context) => `release ${context.release.newVersion}`);

        const out = await formatter({
            changeFiles: [],
            date: "2026-05-23",
            release: {
                changeFiles: [],
                isCascadeBump: false,
                isDependencyBump: false,
                isGroupBump: false,
                name: "@scope/pkg",
                newVersion: "1.0.0",
                oldVersion: "0.9.0",
                reasons: ["EXPLICIT"],
                sources: [],
                type: "minor",
            },
            target: "changelog",
        });

        expect(out).toBe("release 1.0.0");
    });
});

describe("plugin-sdk — type-level guards (smoke tests)", () => {
    it("rejects channel missing `id` at compile-time", () => {
        // @ts-expect-error — `id` is required on NotificationChannel.
        const invalid = defineNotificationChannel({ send: async () => undefined });

        // The runtime identity still returns whatever was passed; the
        // ts-expect-error above is the actual assertion.
        expect(invalid).toBeDefined();
    });

    it("rejects formatter with the wrong return type at compile-time", () => {
        // @ts-expect-error — formatter must return string | Promise<string>.
        const invalid = defineChangelogFormatter(() => 42);

        expect(invalid).toBeDefined();
    });
});
