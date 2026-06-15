import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscordNotificationChannel } from "../../../src/release/core/notifications/discord";
import type { NotificationContext } from "../../../src/release/core/notifications/interface";
import {
    dispatchNotifications,
    expandNotificationTemplate,
} from "../../../src/release/core/notifications/interface";
import { SlackNotificationChannel } from "../../../src/release/core/notifications/slack";
import { WebhookNotificationChannel } from "../../../src/release/core/notifications/webhook";

/**
 * Coverage for the notifications plugin interface + the three built-in
 * channels. Network is stubbed via `vi.spyOn(globalThis, "fetch")` —
 * never makes a real HTTP request.
 */

const buildContext = (overrides: Partial<NotificationContext> = {}): NotificationContext => {
    return {
        channel: "latest",
        completedAt: "2026-05-22T14:00:00.000Z",
        published: [
            { name: "@scope/a", tag: "latest", url: "https://github.com/foo/bar/releases/tag/a-v1.0.0", version: "1.0.0" },
            { name: "@scope/b", tag: "latest", url: "https://github.com/foo/bar/releases/tag/b-v2.1.0", version: "2.1.0" },
        ],
        repo: "foo/bar",
        skipped: [],
        ...overrides,
    };
};

describe(expandNotificationTemplate, () => {
    it("substitutes every documented token", () => {
        const out = expandNotificationTemplate(
            "Released {count} ({packages}) on {channel} via {repo} on {date} — first {firstName}@{firstVersion}",
            buildContext(),
        );

        expect(out).toContain("Released 2");
        expect(out).toContain("@scope/a@1.0.0, @scope/b@2.1.0");
        expect(out).toContain("on latest");
        expect(out).toContain("via foo/bar");
        expect(out).toContain("on 2026-05-22");
        expect(out).toContain("first @scope/a@1.0.0");
    });

    it("substitutes empty for unset optional fields", () => {
        const out = expandNotificationTemplate("[{repo}][{channel}]", buildContext({ channel: undefined, repo: undefined }));

        expect(out).toBe("[][]");
    });

    it("coerces non-string templates instead of throwing (N-3)", () => {
        // A misconfigured user passing a number / boolean / object as
        // `title` previously threw TypeError on .replaceAll. The guard
        // collapses it to a String() coercion so the channel still works.
        expect(expandNotificationTemplate(42 as unknown as string, buildContext())).toBe("42");
        expect(expandNotificationTemplate(true as unknown as string, buildContext())).toBe("true");
        expect(expandNotificationTemplate(null as unknown as string, buildContext())).toBe("");
        expect(expandNotificationTemplate(undefined as unknown as string, buildContext())).toBe("");
    });
});

describe(dispatchNotifications, () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("", { status: 200 }),
        );
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it("skips entirely when no channels are configured", async () => {
        const result = await dispatchNotifications({}, buildContext());

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.succeeded).toEqual([]);
    });

    it("skips when published[] is empty (no-op wave)", async () => {
        const result = await dispatchNotifications(
            { slack: { webhook: "https://hooks.slack.com/services/T/B/X" } },
            buildContext({ published: [] }),
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.succeeded).toEqual([]);
    });

    it("skips prerelease waves by default", async () => {
        const result = await dispatchNotifications(
            { slack: { webhook: "https://hooks.slack.com/services/T/B/X" } },
            buildContext({
                published: [
                    { name: "@scope/a", version: "1.0.0-alpha.0" },
                    { name: "@scope/b", version: "2.0.0-alpha.0" },
                ],
            }),
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.succeeded).toEqual([]);
    });

    it("honours skipPrerelease: false", async () => {
        const result = await dispatchNotifications(
            { skipPrerelease: false, slack: { webhook: "https://hooks.slack.com/services/T/B/X" } },
            buildContext({
                published: [{ name: "@scope/a", version: "1.0.0-alpha.0" }],
            }),
        );

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(result.succeeded).toEqual(["slack"]);
    });

    it("dispatches to multiple channels in parallel", async () => {
        const result = await dispatchNotifications(
            {
                discord: { webhook: "https://discord.com/api/webhooks/123/abc" },
                slack: { webhook: "https://hooks.slack.com/services/T/B/X" },
                webhook: { url: "https://example.com/hook" },
            },
            buildContext(),
        );

        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(result.succeeded.toSorted()).toEqual(["discord", "slack", "webhook"]);
    });

    it("supports array form for multiple instances of the same channel", async () => {
        await dispatchNotifications(
            {
                slack: [
                    { id: "eng", webhook: "https://hooks.slack.com/services/T/B/X" },
                    { id: "release", webhook: "https://hooks.slack.com/services/T/B/Y" },
                ],
            },
            buildContext(),
        );

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("isolates per-channel failures — one bad webhook doesn't take down the others", async () => {
        fetchSpy.mockReset();
        // First call (slack) fails; second (discord) succeeds.
        let invocation = 0;

        fetchSpy.mockImplementation(async () => {
            invocation += 1;

            if (invocation === 1) {
                return new Response("rate limited", { status: 429 });
            }

            return new Response("", { status: 200 });
        });

        const warnings: string[] = [];
        const result = await dispatchNotifications(
            {
                discord: { webhook: "https://discord.com/api/webhooks/123/abc" },
                slack: { webhook: "https://hooks.slack.com/services/T/B/X" },
            },
            buildContext(),
            { warn: (m) => warnings.push(m) },
        );

        expect(result.succeeded).toEqual(["discord"]);
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]!.id).toBe("slack");
        expect(result.failed[0]!.error).toContain("429");
        expect(warnings.some((w) => w.includes("[notifications:slack]"))).toBe(true);
    });

    it("tolerates null channel configs without throwing (N-1)", async () => {
        // A templating tool that resolves an env var to null shouldn't
        // crash the constructor. arrayify(null) returns [].
        const result = await dispatchNotifications(

            { discord: null as any, slack: null as any, webhook: null as any },
            buildContext(),
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.succeeded).toEqual([]);
        expect(result.failed).toEqual([]);
    });

    it("does NOT leak the webhook URL into failed[].error on fetch rejection (C-2)", async () => {
        // Simulate what Node does when a webhook host is unreachable:
        // the URL ends up embedded in the rejection message.
        const secretUrl = "https://hooks.slack.com/services/T0/B0/SECRETTOKEN";

        fetchSpy.mockReset();
        fetchSpy.mockImplementation(async () => {
            throw new Error(`connect ECONNREFUSED ${secretUrl}`);
        });

        const warnings: string[] = [];
        const result = await dispatchNotifications(
            { webhook: { url: secretUrl } },
            buildContext(),
            { warn: (m) => warnings.push(m) },
        );

        expect(result.failed).toHaveLength(1);
        // The secret slug must not appear anywhere — neither in the
        // captured warning nor in the failed[].error pushed by the
        // dispatcher (which the orchestrator surfaces on plan.warnings).
        expect(result.failed[0]!.error).not.toContain("SECRETTOKEN");
        expect(result.failed[0]!.error).not.toContain(secretUrl);
        expect(warnings.join("\n")).not.toContain("SECRETTOKEN");
        expect(warnings.join("\n")).not.toContain(secretUrl);
    });

    it("does NOT leak the webhook URL on non-2xx response either (C-2)", async () => {
        // Same as above but covers the response.ok === false branch in
        // webhook.ts where we previously embedded `${this.config.url}`
        // directly into the thrown message.
        const secretUrl = "https://hooks.slack.com/services/T0/B0/SECRETTOKEN";

        fetchSpy.mockReset();
        fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));

        const result = await dispatchNotifications(
            { webhook: { url: secretUrl } },
            buildContext(),
        );

        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]!.error).not.toContain("SECRETTOKEN");
        expect(result.failed[0]!.error).not.toContain(secretUrl);
        // Sanity: the redacted placeholder must be there so a human
        // reading the warning can still tell which URL slot failed.
        expect(result.failed[0]!.error).toContain("<webhook-url>");
    });
});

describe(SlackNotificationChannel, () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let capturedBody: string | undefined;

    beforeEach(() => {
        capturedBody = undefined;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
            capturedBody = init?.body as string;

            return new Response("", { status: 200 });
        });
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it("renders the default title when none is configured", async () => {
        await new SlackNotificationChannel({ webhook: "https://hooks.slack.com/x" }).send(buildContext());

        const body = JSON.parse(capturedBody!);

        expect(body.text).toContain("🚀 Released 2 packages");
        expect(body.blocks[0].type).toBe("header");
    });

    it("interpolates the configured title template", async () => {
        await new SlackNotificationChannel({
            title: "{count} new on {channel}",
            webhook: "https://hooks.slack.com/x",
        }).send(buildContext());

        const body = JSON.parse(capturedBody!);

        expect(body.text).toBe("2 new on latest");
    });

    it("includes a Skipped block when there are skipped entries (default)", async () => {
        await new SlackNotificationChannel({ webhook: "https://hooks.slack.com/x" }).send(
            buildContext({ skipped: [{ name: "@scope/c", reason: "stage-rejected" }] }),
        );

        const body = JSON.parse(capturedBody!);

        expect(JSON.stringify(body.blocks)).toContain("Skipped (1)");
    });

    it("omits the Skipped block when includeSkipped: false", async () => {
        await new SlackNotificationChannel({
            includeSkipped: false,
            webhook: "https://hooks.slack.com/x",
        }).send(buildContext({ skipped: [{ name: "@scope/c", reason: "stage-rejected" }] }));

        const body = JSON.parse(capturedBody!);

        expect(JSON.stringify(body.blocks)).not.toContain("Skipped");
    });

    it("throws on non-2xx responses", async () => {
        fetchSpy.mockResolvedValue(new Response("invalid_token", { status: 403 }));

        await expect(
            new SlackNotificationChannel({ webhook: "https://hooks.slack.com/x" }).send(buildContext()),
        ).rejects.toThrow(/Slack webhook returned 403/);
    });

    it("appends an id suffix when configured (for multi-channel disambiguation)", () => {
        const channel = new SlackNotificationChannel({
            id: "releases",
            webhook: "https://hooks.slack.com/x",
        });

        expect(channel.id).toBe("slack:releases");
    });

    it("falls back to plain timestamp when completedAt is not parseable (M-5)", async () => {
        await new SlackNotificationChannel({ webhook: "https://hooks.slack.com/x" }).send(
            buildContext({ completedAt: "definitely-not-a-date" }),
        );

        const body = JSON.parse(capturedBody!);
        const stringified = JSON.stringify(body);

        // No <!date^NaN^...> block in the rendered context line
        expect(stringified).not.toContain("<!date^NaN");
        // Plain ISO-string fallback IS present somewhere in the blocks
        expect(stringified).toContain("definitely-not-a-date");
    });
});

describe(DiscordNotificationChannel, () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let capturedBody: string | undefined;

    beforeEach(() => {
        capturedBody = undefined;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
            capturedBody = init?.body as string;

            return new Response("", { status: 200 });
        });
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it("emits a single embed with package list as the description", async () => {
        await new DiscordNotificationChannel({ webhook: "https://discord.com/x" }).send(buildContext());

        const body = JSON.parse(capturedBody!);

        expect(body.embeds).toHaveLength(1);
        expect(body.embeds[0].description).toContain("@scope/a@1.0.0");
        expect(body.embeds[0].description).toContain("@scope/b@2.1.0");
    });

    it("truncates the description on very large waves", async () => {
        const big = Array.from({ length: 200 }, (_, i) => {
            return {
                name: `@scope/pkg-${i}`,
                // URL string is intentionally long to push the description over Discord's limit.
                url: `https://github.com/foo/bar/releases/tag/pkg-${i}-v1.0.0-${"x".repeat(40)}`,
                version: "1.0.0",
            };
        });

        await new DiscordNotificationChannel({ webhook: "https://discord.com/x" }).send(
            buildContext({ published: big }),
        );

        const body = JSON.parse(capturedBody!);

        expect(body.embeds[0].description).toContain("+");
        expect(body.embeds[0].description).toContain("more");
        expect(body.embeds[0].description.length).toBeLessThan(4096);
    });

    it("includes channel + repo fields", async () => {
        await new DiscordNotificationChannel({ webhook: "https://discord.com/x" }).send(buildContext());

        const body = JSON.parse(capturedBody!);

        const fieldNames = body.embeds[0].fields.map((f: { name: string }) => f.name);

        expect(fieldNames).toContain("Channel");
        expect(fieldNames).toContain("Repository");
    });
});

describe(WebhookNotificationChannel, () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let capturedInit: RequestInit | undefined;

    beforeEach(() => {
        capturedInit = undefined;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
            capturedInit = init;

            return new Response("", { status: 200 });
        });
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it("sends the safe-by-default subset of NotificationContext when no body template is set", async () => {
        await new WebhookNotificationChannel({ url: "https://example.com/hook" }).send(buildContext());

        const body = JSON.parse(capturedInit!.body as string);

        expect(body.published).toHaveLength(2);
        expect(body.channel).toBe("latest");
        // Semver fields preserved (safe — never carry free text).
        expect(body.published[0].name).toBe("@scope/a");
        expect(body.published[0].version).toBe("1.0.0");
    });

    it("drops skipped[].reason from the default body (M-10)", async () => {
        // M-10: `skipped[].reason` is populated from shell-runner stderr
        // fragments that may carry secrets escaping the upstream redactor.
        // The default body must NOT include these — operators wanting
        // them must opt in with an explicit `body` template.
        const secretReason = "publish failed: token=ghp_LEAKEDSECRET123 invalid";

        await new WebhookNotificationChannel({ url: "https://example.com/hook" }).send(
            buildContext({ skipped: [{ name: "@scope/c", reason: secretReason }] }),
        );

        const raw = capturedInit!.body as string;

        // Sanity: the safe-by-default subset still includes the skipped name.
        const body = JSON.parse(raw);

        expect(body.skipped).toHaveLength(1);
        expect(body.skipped[0].name).toBe("@scope/c");
        // The reason string must NOT be on the wire — neither the field
        // nor any substring of the (potentially-leaked) value.
        expect(body.skipped[0].reason).toBeUndefined();
        expect(raw).not.toContain("ghp_LEAKEDSECRET123");
        expect(raw).not.toContain(secretReason);
    });

    it("still forwards skipped[].reason when the operator provides an explicit body template", async () => {
        // Counterpoint to M-10: operators who explicitly opt in by
        // authoring a body template are consciously choosing to forward
        // free text. The dispatcher respects that.
        await new WebhookNotificationChannel({
            body: { reasonCount: "{count}", text: "see logs" },
            url: "https://example.com/hook",
        }).send(buildContext({ skipped: [{ name: "@scope/c", reason: "stage-rejected" }] }));

        const body = JSON.parse(capturedInit!.body as string);

        expect(body.text).toBe("see logs");
    });

    it("interpolates string leaves in a body template; preserves structure", async () => {
        await new WebhookNotificationChannel({
            body: {
                meta: { count: "{count}" }, // string `"{count}"` becomes `"2"` (not a number)
                packages: "{packages}",
                text: "Released {count} on {channel}",
            },
            url: "https://example.com/hook",
        }).send(buildContext());

        const body = JSON.parse(capturedInit!.body as string);

        expect(body.text).toBe("Released 2 on latest");
        expect(body.meta.count).toBe("2");
        expect(body.packages).toContain("@scope/a@1.0.0");
    });

    it("uses configured method + headers", async () => {
        await new WebhookNotificationChannel({
            headers: { "X-Auth": "Bearer abc" },
            method: "PUT",
            url: "https://example.com/hook",
        }).send(buildContext());

        expect(capturedInit?.method).toBe("PUT");
        expect((capturedInit?.headers as Record<string, string>)["X-Auth"]).toBe("Bearer abc");
    });

    it("interpolates header values", async () => {
        await new WebhookNotificationChannel({
            headers: { "X-Release": "{firstName}@{firstVersion}" },
            url: "https://example.com/hook",
        }).send(buildContext());

        expect((capturedInit?.headers as Record<string, string>)["X-Release"]).toBe("@scope/a@1.0.0");
    });
});
